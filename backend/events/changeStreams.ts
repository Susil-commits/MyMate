import Booking from "../models/Booking.js";
import { getIo } from "../utils/socket.js";
import logger from "../config/logger.js";

export const initializeChangeStreams = () => {
  // Check if we are running in a replica set environment.
  // Change streams require a replica set (like MongoDB Atlas).
  try {
    const bookingStream = Booking.watch([], { fullDocument: 'updateLookup' });

    bookingStream.on("change", (change) => {
      if (change.operationType === "update" || change.operationType === "replace") {
        const booking = change.fullDocument;
        if (!booking) return;
        
        try {
          const io = getIo();
          // Emit to the specific booking room
          io.to(`booking_${booking._id}`).emit("booking_update", booking);
          logger.info(`[ChangeStream] Broadcasted update for booking ${booking._id}`);
        } catch (err) {
          // Socket might not be fully initialized or failed to get instance
        }
      }
    });

    bookingStream.on("error", (error) => {
      logger.error("[ChangeStream] Booking stream error:", error);
    });

    logger.info("[ChangeStream] Listening to Booking collection changes");
  } catch (err) {
    logger.warn("[ChangeStream] Failed to initialize (Ensure MongoDB is running as a Replica Set)");
  }
};
