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

      // Bug 18 Fix: Use two separate aggregation pipelines — one per user, one per driver.
      // The old code grouped by { user, driver } COMBINATION, which meant a user who
      // cancelled 2 bookings with Driver A and 2 with Driver B only had count:2 in each
      // group — never hitting the >=3 threshold despite 4 total cancellations.
      //
      // Bug 10 Fix: Exclude auto-cancelled bookings (system-initiated) from the fraud count
      // so legitimate users with inactive drivers aren't falsely flagged.
      const [userCancelStats, driverCancelStats] = await Promise.all([
        Booking.aggregate([
          {
            $match: {
              status: "cancelled",
              updatedAt: { $gte: today },
              // Exclude system auto-cancellations — these should not penalise the user
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
              // Exclude system auto-cancellations from driver fraud assessment too
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
        // Bug 10 Fix: Mark users as suspicious rather than hard-suspending them.
        // Use isSuspicious flag so admins can review and make the final decision.
        await User.updateMany(
          { _id: { $in: Array.from(suspiciousUsers) } },
          { $set: { isSuspicious: true } }
        );
        logger.warn(`Fraud Alert: Flagged ${suspiciousUsers.size} users for excessive manual cancellations.`);
      }

      if (suspiciousDrivers.size > 0) {
        // Bug 10 Fix: Mark drivers as suspicious rather than immediately deactivating.
        // Hard suspension without appeal is too aggressive for legitimate drivers.
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
