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

import { getCorrelationId } from "../utils/correlationContext.js";

export const publishKafkaEvent = async (
  topic: KafkaTopic | string,
  key: string,
  payload: any
): Promise<boolean> => {
  if (!KAFKA_ENABLED) return false;

  if (!isConnected || !producer) {
    const reconnected = await initKafkaProducer();
    if (!reconnected || !producer) return false;
  }

  const correlationId = getCorrelationId();
  const eventPayload =
    typeof payload === "object" && payload !== null
      ? { ...payload, correlationId: payload.correlationId || correlationId }
      : payload;

  const headers: Record<string, string> = {};
  if (correlationId) {
    headers["x-correlation-id"] = correlationId;
  }

  try {
    await producer.send({
      topic,
      messages: [
        {
          key,
          value: JSON.stringify(eventPayload),
          timestamp: Date.now().toString(),
          headers,
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

export interface KafkaDlqMessage {
  originalTopic: string;
  partition?: number;
  offset?: string;
  key: string | null;
  payload: any;
  error: {
    message: string;
    stack?: string;
  };
  failedAt: string;
}

/**
 * Publishes failed message payloads to a Dead-Letter Queue (*.dlq) topic.
 * Prevents message loss when consumer processing encounters an unhandled exception.
 */
export const publishKafkaDlq = async (
  originalTopic: string,
  key: string | null | undefined,
  rawMessage: any,
  err: any,
  partition?: number,
  offset?: string
): Promise<boolean> => {
  let parsedPayload: any = rawMessage;
  if (typeof rawMessage === "string") {
    try {
      parsedPayload = JSON.parse(rawMessage);
    } catch {
      parsedPayload = rawMessage;
    }
  }

  const dlqPayload: KafkaDlqMessage = {
    originalTopic,
    partition,
    offset,
    key: key || null,
    payload: parsedPayload,
    error: {
      message: err?.message || String(err),
      stack: err?.stack,
    },
    failedAt: new Date().toISOString(),
  };

  const dlqTopic = `${originalTopic}.dlq`;
  logger.warn(
    `[Kafka DLQ] Routing failed message from ${originalTopic} to ${dlqTopic} (offset: ${offset ?? "n/a"}, partition: ${partition ?? "n/a"})`
  );
  return publishKafkaEvent(dlqTopic, key || "dlq-fallback", dlqPayload);
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
