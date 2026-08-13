import { Consumer } from "kafkajs";
import { kafka, KAFKA_GROUP_ID } from "../../config/kafka.js";
import { KAFKA_TOPICS } from "../topics.js";
import logger from "../../config/logger.js";
import { createNotification } from "../../models/Notification.js";
import { sendKycStatusEmail } from "../../config/email.js";
import Driver from "../../models/Driver.js";

let consumer: Consumer | null = null;

export const startKycConsumer = async (): Promise<Consumer | null> => {
  try {
    consumer = kafka.consumer({ groupId: `${KAFKA_GROUP_ID}-kyc` });
    await consumer.connect();

    await consumer.subscribe({
      topics: [KAFKA_TOPICS.DRIVER_KYC_STATUS],
      fromBeginning: false,
    });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;

        try {
          const payload = JSON.parse(message.value.toString());
          logger.info(`[KycConsumer] Received KYC status event for driver ${payload.driverId}`);

          const { driverId, status } = payload;
          const driver = await Driver.findById(driverId);
          if (driver) {
            await sendKycStatusEmail(driver, status).catch((err) => {
              logger.error("[KycConsumer] Error sending KYC email:", err);
            });

            await createNotification({
              userId: driver._id,
              userModel: "Driver",
              title: "KYC Verification Update",
              message:
                status === "approved"
                  ? "Your KYC has been approved. You are now live on the platform."
                  : "Your KYC was rejected. Please update your documents and resubmit.",
              type: "kyc",
              link: "/driver/profile",
            });
          }
        } catch (err: any) {
          logger.error(`[KycConsumer] Error processing KYC message: ${err.message}`);
        }
      },
    });

    logger.info("[KycConsumer] Started successfully and subscribed to topics.");
    return consumer;
  } catch (err: any) {
    logger.warn(`[KycConsumer] Could not start consumer: ${err.message}`);
    return null;
  }
};

export const stopKycConsumer = async (): Promise<void> => {
  if (consumer) {
    try {
      await consumer.disconnect();
      logger.info("[KycConsumer] Disconnected.");
    } catch (err: any) {
      logger.error(`[KycConsumer] Error disconnecting: ${err.message}`);
    }
  }
};
