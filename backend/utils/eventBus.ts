import { EventEmitter } from "events";
import logger from "../config/logger.js";

// Extend EventEmitter to have strong typing for events
class AppEventBus extends EventEmitter {}

export const eventBus = new AppEventBus();

// Optionally, listen to all events for audit logging
// A simple way to do this without overriding emit is to wrap it,
// or just manually bind to specific known events.

export enum AppEvents {
  BOOKING_CREATED = "booking.created",
  BOOKING_UPDATED = "booking.updated",
  DRIVER_APPROVED = "driver.approved",
  USER_REGISTERED = "user.registered"
}

eventBus.on(AppEvents.BOOKING_CREATED, (data) => {
  logger.info(`[EventBus] BOOKING_CREATED: ${data.bookingId}`);
  // Webhooks can be triggered from here instead of inline
});

eventBus.on(AppEvents.DRIVER_APPROVED, (data) => {
  logger.info(`[EventBus] DRIVER_APPROVED: ${data.driverId}`);
});
