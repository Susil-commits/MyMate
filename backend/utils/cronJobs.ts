import cron from "node-cron";
import Booking from "../models/Booking.js";
import logger from "../config/logger.js";

// Run every hour
export const startCronJobs = () => {
  cron.schedule("0 * * * *", async () => {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const result = await Booking.updateMany(
        {
          status: "pending",
          createdAt: { $lt: twentyFourHoursAgo },
        },
        {
          $set: { status: "cancelled", cancellationReason: "Auto-cancelled due to driver inactivity" }
        }
      );
      
      if (result.modifiedCount > 0) {
        logger.info(`Auto-cancelled ${result.modifiedCount} stale pending bookings.`);
      }
    } catch (error) {
      logger.error("Error in stale bookings cron job:", error);
    }
  });
  
  logger.info("Cron jobs initialized.");
};
