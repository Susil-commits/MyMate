import { kafka, KAFKA_ENABLED } from "../config/kafka.js";
import logger from "../config/logger.js";
import { initKafkaProducer, disconnectKafkaProducer, isKafkaProducerConnected } from "./producer.js";
import { startBookingConsumer, stopBookingConsumer } from "./consumers/bookingConsumer.js";
import { startPaymentConsumer, stopPaymentConsumer } from "./consumers/paymentConsumer.js";
import { startKycConsumer, stopKycConsumer } from "./consumers/kycConsumer.js";
import { KAFKA_TOPICS } from "./topics.js";

export const createKafkaTopics = async (): Promise<boolean> => {
  if (!KAFKA_ENABLED) return false;
  const admin = kafka.admin();
  try {
    await admin.connect();
    const existingTopics = await admin.listTopics();
    const topicsToCreate = Object.values(KAFKA_TOPICS).filter(
      (topic) => !existingTopics.includes(topic)
    );

    if (topicsToCreate.length > 0) {
      await admin.createTopics({
        topics: topicsToCreate.map((topic) => ({
          topic,
          numPartitions: 1,
          replicationFactor: 1,
        })),
      });
      logger.info(`[Kafka Admin] Created topics: ${topicsToCreate.join(", ")}`);
    } else {
      logger.info("[Kafka Admin] All required topics already exist.");
    }
    await admin.disconnect();
    return true;
  } catch (err: any) {
    logger.warn(`[Kafka Admin] Could not auto-create topics: ${err.message}`);
    try {
      await admin.disconnect();
    } catch (_) {}
    return false;
  }
};

export const startKafka = async (): Promise<boolean> => {
  if (!KAFKA_ENABLED) {
    logger.info("[Kafka] Disabled by environment configuration.");
    return false;
  }

  logger.info("[Kafka] Initializing connection...");

  // 1. Connect Producer
  const producerConnected = await initKafkaProducer();
  if (!producerConnected) {
    logger.warn("[Kafka] Producer failed to connect. Skipping consumers.");
    return false;
  }

  // 2. Create topics if missing
  await createKafkaTopics();

  // 3. Start Consumers in parallel
  await Promise.all([
    startBookingConsumer(),
    startPaymentConsumer(),
    startKycConsumer(),
  ]);

  logger.info("[Kafka] Full connection & messaging engine running successfully.");
  return true;
};

export const stopKafka = async (): Promise<void> => {
  logger.info("[Kafka] Stopping Kafka connections...");
  await Promise.all([
    stopBookingConsumer(),
    stopPaymentConsumer(),
    stopKycConsumer(),
    disconnectKafkaProducer(),
  ]);
  logger.info("[Kafka] Stopped cleanly.");
};

export const isKafkaConnected = (): boolean => {
  return isKafkaProducerConnected();
};

export { publishKafkaEvent } from "./producer.js";
export { KAFKA_TOPICS } from "./topics.js";
