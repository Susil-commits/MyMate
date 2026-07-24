import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";

interface AuthenticatedSocket extends Socket {
  user?: any;
}

let io: Server;

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
