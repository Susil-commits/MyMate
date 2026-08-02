import { EventEmitter } from "events";
import { createNotification } from "../models/Notification.js";
import { sendBookingConfirmation, sendBookingStatusUpdate } from "../config/email.js";
import { getIo } from "../utils/socket.js";
import User from "../models/User.js";
import Driver from "../models/Driver.js";

// Global Event Bus
export const eventBus = new EventEmitter();

// Listeners for BOOKING_CREATED
eventBus.on("BOOKING_CREATED", async ({ primaryBooking, driverId, user, isRecurring, hireType }) => {
  try {
    const driver = await Driver.findById(driverId);
    if (!driver) return;

    // 1. Create In-App Notification
    await createNotification({
      userId: driverId,
      userModel: "Driver",
      title: "New Booking Request",
      message: `New ${hireType} booking request${isRecurring ? ' (Recurring)' : ''} from ${user.name || "a customer"}.`,
      type: "booking", 
      link: `/bookings/${primaryBooking._id}`,
    });

    // 2. Send Confirmation Email
    await sendBookingConfirmation(user, driver, primaryBooking);

    // 3. Emit Real-time Socket Event
    try {
      const io = getIo();
      io.to(String(driverId)).emit("new_notification", {
        title: "New Booking Request",
        body: `New ${hireType} booking request from ${user.name || "a customer"}.`,
        link: `/driver/bookings`,
      });
    } catch (err) {
      console.error("[EventBus] Socket error on BOOKING_CREATED:", err);
    }
  } catch (err) {
    console.error("[EventBus] Error processing BOOKING_CREATED:", err);
  }
});

// Listeners for BOOKING_STATUS_CHANGED
eventBus.on("BOOKING_STATUS_CHANGED", async ({ booking, user, driver, status }) => {
  try {
    // Determine notification copy
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

    // 1. Send Email
    await sendBookingStatusUpdate(user, driver, booking, status).catch(() => {});

    // 2. Create Notification
    await createNotification({
      userId: user._id,
      userModel: "User",
      title,
      message,
      type: "booking",
      link: `/bookings/${booking._id}`
    });

    // 3. Socket Push
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
