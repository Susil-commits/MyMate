import cron from "node-cron";
import Booking from "../models/Booking.js";
import logger from "../config/logger.js";

// Run every hour
export const startCronJobs = () => {
  cron.schedule("0 * * * *", async () => {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const staleBookings = await Booking.find({
        status: "pending",
        createdAt: { $lt: twentyFourHoursAgo },
      }).select("_id user driver status");

      if (staleBookings.length > 0) {
        const ids = staleBookings.map((b) => b._id);
        const result = await Booking.updateMany(
          { _id: { $in: ids } },
          { $set: { status: "cancelled", cancellationReason: "Auto-cancelled due to driver inactivity" } }
        );

        if (result.modifiedCount > 0) {
          try {
            const { getIo } = await import("./socket.js");
            const io = getIo();
            staleBookings.forEach((b) => {
              io.to(`booking_${b._id}`).emit("booking_update", { ...b.toObject(), status: "cancelled" });
              io.to(String(b.user)).emit("new_notification", {
                title: "Booking Cancelled",
                body: "Your booking request was auto-cancelled due to driver inactivity.",
                link: `/bookings/${b._id}`,
              });
              io.to(String(b.driver)).emit("new_notification", {
                title: "Booking Cancelled",
                body: "A pending booking request was auto-cancelled due to inactivity.",
                link: `/driver/bookings`,
              });
            });
          } catch (err) {
            logger.error("Socket emit failed in cron job", err);
          }
          logger.info(`Auto-cancelled ${result.modifiedCount} stale pending bookings.`);
        }
      }
    } catch (error) {
      logger.error("Error in stale bookings cron job:", error);
    }
  });
  
  logger.info("Cron jobs initialized.");
};
