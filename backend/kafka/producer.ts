import { Producer } from "kafkajs";
import { kafka, KAFKA_ENABLED } from "../config/kafka.js";
import logger from "../config/logger.js";
import { KafkaTopic } from "./topics.js";

let producer: Producer | null = null;
let isConnected = false;

export const initKafkaProducer = async (): Promise<boolean> => {
  if (!KAFKA_ENABLED) {
    logger.info("[Kafka Producer] Kafka is disabled via configuration.");
    return false;
  }

  if (producer && isConnected) return true;

  try {
    producer = kafka.producer();
    await producer.connect();
    isConnected = true;
    logger.info("[Kafka Producer] Connected successfully.");
    return true;
  } catch (err: any) {
    isConnected = false;
    logger.warn(`[Kafka Producer] Connection failed: ${err.message}. Event publishing will be skipped.`);
    return false;
  }
};

export const publishKafkaEvent = async (
  topic: KafkaTopic,
  key: string,
  payload: any
): Promise<boolean> => {
  if (!KAFKA_ENABLED) return false;

  if (!isConnected || !producer) {
    const reconnected = await initKafkaProducer();
    if (!reconnected || !producer) return false;
  }

  try {
    await producer.send({
      topic,
      messages: [
        {
          key,
          value: JSON.stringify(payload),
          timestamp: Date.now().toString(),
        },
      ],
    });
    logger.info(`[Kafka Producer] Published event to ${topic} (key: ${key})`);
    return true;
  } catch (err: any) {
    logger.error(`[Kafka Producer] Error publishing to ${topic}: ${err.message}`);
    return false;
  }
};

export const disconnectKafkaProducer = async (): Promise<void> => {
  if (producer && isConnected) {
    try {
      await producer.disconnect();
      isConnected = false;
      logger.info("[Kafka Producer] Disconnected successfully.");
    } catch (err: any) {
      logger.error(`[Kafka Producer] Error on disconnect: ${err.message}`);
    }
  }
};

export const isKafkaProducerConnected = (): boolean => isConnected;
