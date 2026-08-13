import { EventEmitter } from "events";
import { getIo } from "../utils/socket.js";
import Driver from "../models/Driver.js";

// Global Event Bus (configured for real-time WebSocket pushes)
export const eventBus = new EventEmitter();
eventBus.setMaxListeners(20);

/**
 * Event bus strictly handles real-time Socket.io pushes.
 * Durable side-effects (database persistence, emails, wallet processing)
 * are handled asynchronously by Kafka consumers.
 */

// BOOKING_CREATED — Socket push to the assigned driver only
eventBus.on("BOOKING_CREATED", async ({ primaryBooking, driverId, user, isRecurring, hireType }) => {
  try {
    try {
      const io = getIo();
      io.to(String(driverId)).emit("new_notification", {
        title: "New Booking Request",
        body: `New ${hireType} booking request${isRecurring ? ' (Recurring)' : ''} from ${user.name || "a customer"}.`,
        link: `/driver/bookings`,
      });
    } catch (err) {
      console.error("[EventBus] Socket error on BOOKING_CREATED:", err);
    }
  } catch (err) {
    console.error("[EventBus] Error processing BOOKING_CREATED:", err);
  }
});

// BOOKING_STATUS_CHANGED — Socket push to user and driver rooms
eventBus.on("BOOKING_STATUS_CHANGED", async ({ booking, user, driver, status }) => {
  try {
    let title = "Booking Update";
    let message = `Your booking status changed to ${status}.`;

    if (status === "accepted") {
      title = "Booking Accepted!";
      message = `${driver.name} has accepted your booking.`;
    } else if (status === "rejected") {
      title = "Booking Rejected";
      message = `${driver.name} is unable to accept your booking at this time.`;
    } else if (status === "started") {
      title = "Ride Started";
      message = "Your ride has officially started.";
    } else if (status === "completed") {
      title = "Ride Completed";
      message = "Your ride has ended. Thank you for using MyMate!";
    }

    try {
      const io = getIo();
      io.to(String(user._id)).emit("notification", { title, message });
      io.to(String(driver._id)).emit("new_notification", { title, message });
      io.to(`booking_${booking._id}`).emit("booking_update", booking);
    } catch (e) { }

  } catch (err) {
    console.error("[EventBus] Error processing BOOKING_STATUS_CHANGED:", err);
  }
});

// DRIVER_VERIFIED — Socket push to driver (email/notification handled by Kafka kycConsumer)
eventBus.on("DRIVER_VERIFIED", async ({ driver, status }) => {
  try {
    const io = getIo();
    io.to(String(driver._id)).emit("kyc_update", { status });
  } catch (err) {
    // Socket may not be initialized in test/dev environments
  }
});
