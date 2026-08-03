import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import Booking from "../models/Booking.js";
import Driver from "../models/Driver.js";
import { createNotification } from "../models/Notification.js";

interface AuthenticatedSocket extends Socket {
  user?: any;
}

let io: Server;

// In-memory throttling map to avoid DB overload
const lastDbUpdate = new Map<string, number>();

// Haversine distance in meters
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const initSocket = (httpServer: HttpServer, allowedOrigins: string[]) => {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Socket authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket: AuthenticatedSocket) => {
    console.log(`Socket connected: ${socket.id}, User ID: ${socket.user?.id}`);

    if (socket.user?.id) {
      socket.join(socket.user.id);
    }

    socket.on("join_booking", (bookingId: string) => {
      socket.join(`booking_${bookingId}`);
    });

    socket.on("leave_booking", (bookingId: string) => {
      socket.leave(`booking_${bookingId}`);
    });
    
    socket.on("join_conversation", (conversationId: string) => {
      socket.join(`conv_${conversationId}`);
    });

    socket.on("leave_conversation", (conversationId: string) => {
      socket.leave(`conv_${conversationId}`);
    });

    socket.on("typing_start", (conversationId: string) => {
      socket.to(`conv_${conversationId}`).emit("typing_start", { conversationId, userId: socket.user?.id });
    });

    socket.on("typing_stop", (conversationId: string) => {
      socket.to(`conv_${conversationId}`).emit("typing_stop", { conversationId, userId: socket.user?.id });
    });

    // Live Location Tracking
    socket.on("location_update", async (data: { bookingId: string, lat: number, lng: number, heading?: number }) => {
      // Validate incoming coordinates are numbers
      if (typeof data.lat !== "number" || typeof data.lng !== "number" || isNaN(data.lat) || isNaN(data.lng)) {
        return; // Silently ignore malformed location events
      }

      socket.to(`booking_${data.bookingId}`).emit("location_update", {
        driverId: socket.user?.id,
        lat: data.lat,
        lng: data.lng,
        heading: data.heading,
        timestamp: Date.now()
      });

      // Throttle DB updates to once every 10 seconds per driver
      const driverId = socket.user?.id;
      const now = Date.now();
      if (driverId && (!lastDbUpdate.has(driverId) || now - lastDbUpdate.get(driverId)! > 10000)) {
        lastDbUpdate.set(driverId, now);
        
        try {
          // Update driver's current location
          await Driver.findByIdAndUpdate(driverId, {
            currentLocation: { lat: data.lat, lng: data.lng }
          });

          // Geofencing Check
          const booking = await Booking.findById(data.bookingId);

          // Bug 7 Fix: Validate that this driver actually owns the booking before
          // triggering any geofencing logic. Without this check, any driver could
          // send a spoofed bookingId and trigger arrival notifications for arbitrary users.
          if (
            booking &&
            booking.status === "ongoing" &&
            !booking.driverArrivedNotified &&
            booking.pickupCoordinates?.lat &&
            String(booking.driver) === String(driverId) // Ownership check
          ) {
            const distance = getDistanceInMeters(
              data.lat, data.lng, 
              booking.pickupCoordinates.lat, booking.pickupCoordinates.lng
            );

            // If within 500 meters, trigger arrival notification
            if (distance <= 500) {
              booking.driverArrivedNotified = true;
              await booking.save();
              
              await createNotification({
                userId: booking.user,
                userModel: "User",
                title: "Driver Arriving Soon",
                message: "Your driver is within 500 meters of the pickup location.",
                type: "system",
                link: `/bookings/${booking._id}`
              });

              // Also emit a real-time event to the user
              io.to(booking.user.toString()).emit("notification", {
                title: "Driver Arriving Soon",
                message: "Your driver is arriving shortly!"
              });
            }
          }
        } catch (err) {
          console.error("Geofencing update error:", err);
        }
      }
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIo = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};
