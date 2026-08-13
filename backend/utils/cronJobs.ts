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

  // Run every day at midnight to detect fraud (excessive cancellations)
  cron.schedule("0 0 * * *", async () => {
    try {
      const User = (await import("../models/User.js")).default;
      const Driver = (await import("../models/Driver.js")).default;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Aggregate cancellations independently per user and per driver
      const [userCancelStats, driverCancelStats] = await Promise.all([
        Booking.aggregate([
          {
            $match: {
              status: "cancelled",
              updatedAt: { $gte: today },
              // Exclude system auto-cancellations
              cancellationReason: { $ne: "Auto-cancelled due to driver inactivity" },
            },
          },
          {
            $group: {
              _id: "$user",
              count: { $sum: 1 },
            },
          },
        ]),
        Booking.aggregate([
          {
            $match: {
              status: "cancelled",
              updatedAt: { $gte: today },
              cancellationReason: { $ne: "Auto-cancelled due to driver inactivity" },
            },
          },
          {
            $group: {
              _id: "$driver",
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

      const suspiciousUsers = new Set<string>();
      const suspiciousDrivers = new Set<string>();

      userCancelStats.forEach((stat) => {
        if (stat.count >= 3 && stat._id) {
          suspiciousUsers.add(String(stat._id));
        }
      });

      driverCancelStats.forEach((stat) => {
        if (stat.count >= 3 && stat._id) {
          suspiciousDrivers.add(String(stat._id));
        }
      });

      if (suspiciousUsers.size > 0) {
        // Flag user accounts as suspicious for admin review
        await User.updateMany(
          { _id: { $in: Array.from(suspiciousUsers) } },
          { $set: { isSuspicious: true } }
        );
        logger.warn(`Fraud Alert: Flagged ${suspiciousUsers.size} users for excessive manual cancellations.`);
      }

      if (suspiciousDrivers.size > 0) {
        // Flag driver accounts as suspicious for admin review
        await Driver.updateMany(
          { _id: { $in: Array.from(suspiciousDrivers) } },
          { $set: { isSuspicious: true } }
        );
        logger.warn(`Fraud Alert: Flagged ${suspiciousDrivers.size} drivers for excessive cancellations (pending admin review).`);
      }

    } catch (error) {
      logger.error("Error in fraud detection cron job:", error);
    }
  });
  
  logger.info("Cron jobs initialized.");
};
