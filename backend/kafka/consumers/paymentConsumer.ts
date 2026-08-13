import { Consumer } from "kafkajs";
import { kafka, KAFKA_GROUP_ID } from "../../config/kafka.js";
import { KAFKA_TOPICS } from "../topics.js";
import logger from "../../config/logger.js";
import { createNotification } from "../../models/Notification.js";

let consumer: Consumer | null = null;

export const startPaymentConsumer = async (): Promise<Consumer | null> => {
  try {
    consumer = kafka.consumer({ groupId: `${KAFKA_GROUP_ID}-payment` });
    await consumer.connect();

    await consumer.subscribe({
      topics: [KAFKA_TOPICS.PAYMENT_COMPLETED],
      fromBeginning: false,
    });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;

        try {
          const payload = JSON.parse(message.value.toString());
          logger.info(`[PaymentConsumer] Received payment completed event for booking ${payload.bookingId}`);

          const { driverId, bookingId, totalAmount, driverAmount, paymentMethod } = payload;

          if (driverId) {
            await createNotification({
              userId: driverId,
              userModel: "Driver",
              title: "Payment Received",
              message: `Payment of ₹${totalAmount} processed (${paymentMethod || "online"}). ₹${driverAmount?.toFixed(2) || "0.00"} credited.`,
              type: "payment",
              link: `/bookings/${bookingId}`,
            }).catch(() => {});
          }
        } catch (err: any) {
          logger.error(`[PaymentConsumer] Error processing message: ${err.message}`);
        }
      },
    });

    logger.info("[PaymentConsumer] Started successfully and subscribed to topics.");
    return consumer;
  } catch (err: any) {
    logger.warn(`[PaymentConsumer] Could not start consumer: ${err.message}`);
    return null;
  }
};

export const stopPaymentConsumer = async (): Promise<void> => {
  if (consumer) {
    try {
      await consumer.disconnect();
      logger.info("[PaymentConsumer] Disconnected.");
    } catch (err: any) {
      logger.error(`[PaymentConsumer] Error disconnecting: ${err.message}`);
    }
  }
};
