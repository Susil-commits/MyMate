import { Consumer } from "kafkajs";
import { kafka, KAFKA_GROUP_ID } from "../../config/kafka.js";
import { KAFKA_TOPICS } from "../topics.js";
import logger from "../../config/logger.js";
import { createNotification } from "../../models/Notification.js";
import { sendBookingConfirmation, sendBookingStatusUpdate } from "../../config/email.js";
import Driver from "../../models/Driver.js";

let consumer: Consumer | null = null;

export const startBookingConsumer = async (): Promise<Consumer | null> => {
  try {
    consumer = kafka.consumer({ groupId: `${KAFKA_GROUP_ID}-booking` });
    await consumer.connect();
    
    await consumer.subscribe({
      topics: [KAFKA_TOPICS.BOOKING_CREATED, KAFKA_TOPICS.BOOKING_STATUS_CHANGED],
      fromBeginning: false,
    });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;
        
        try {
          const payload = JSON.parse(message.value.toString());
          logger.info(`[BookingConsumer] Received event on ${topic}`);

          if (topic === KAFKA_TOPICS.BOOKING_CREATED) {
            const { primaryBooking, driverId, user, isRecurring, hireType } = payload;
            const driver = await Driver.findById(driverId);
            if (driver) {
              await createNotification({
                userId: driverId,
                userModel: "Driver",
                title: "New Booking Request",
                message: `New ${hireType} booking request${isRecurring ? ' (Recurring)' : ''} from ${user.name || "a customer"}.`,
                type: "booking",
                link: `/bookings/${primaryBooking._id}`,
              });
              await sendBookingConfirmation(user, driver, primaryBooking).catch((err) => {
                logger.error("[BookingConsumer] Failed sending confirmation email:", err);
              });
            }
          } else if (topic === KAFKA_TOPICS.BOOKING_STATUS_CHANGED) {
            const { booking, user, driver, status } = payload;
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

            await sendBookingStatusUpdate(user, driver, booking, status).catch(() => {});

            if (user && user._id) {
              await createNotification({
                userId: user._id,
                userModel: "User",
                title,
                message,
                type: "booking",
                link: `/bookings/${booking._id}`,
              });
            }
          }
        } catch (err: any) {
          logger.error(`[BookingConsumer] Error processing message on ${topic}: ${err.message}`);
        }
      },
    });

    logger.info("[BookingConsumer] Started successfully and subscribed to topics.");
    return consumer;
  } catch (err: any) {
    logger.warn(`[BookingConsumer] Could not start consumer: ${err.message}`);
    return null;
  }
};

export const stopBookingConsumer = async (): Promise<void> => {
  if (consumer) {
    try {
      await consumer.disconnect();
      logger.info("[BookingConsumer] Disconnected.");
    } catch (err: any) {
      logger.error(`[BookingConsumer] Error disconnecting: ${err.message}`);
    }
  }
};
