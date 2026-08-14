import { Kafka, KafkaConfig, logLevel, SASLOptions } from "kafkajs";
import fs from "fs";
import path from "path";
import logger from "./logger.js";

const brokers = (process.env.KAFKA_BROKERS || "localhost:9092")
  .split(",")
  .map((b) => b.trim())
  .filter(Boolean);

const clientId = process.env.KAFKA_CLIENT_ID || "mymate-backend";
export const KAFKA_GROUP_ID = process.env.KAFKA_GROUP_ID || "mymate-consumer-group";
export const KAFKA_ENABLED = process.env.KAFKA_ENABLED !== "false";

let saslConfig: SASLOptions | undefined = undefined;
if (process.env.KAFKA_SASL_USERNAME && process.env.KAFKA_SASL_PASSWORD) {
  const mechanism = (process.env.KAFKA_SASL_MECHANISM || "plain").toLowerCase() as "plain" | "scram-sha-256" | "scram-sha-512";
  saslConfig = {
    mechanism,
    username: process.env.KAFKA_SASL_USERNAME,
    password: process.env.KAFKA_SASL_PASSWORD,
  };
}

let sslConfig: boolean | { ca?: string[]; rejectUnauthorized?: boolean } | undefined = undefined;

if (process.env.KAFKA_SSL === "true") {
  const rejectUnauthorized = process.env.KAFKA_SSL_REJECT_UNAUTHORIZED !== "false";
  let ca: string[] | undefined = undefined;

  if (process.env.KAFKA_CA_CERT) {
    // Direct PEM certificate passed via environment variable (handles literal \n from cloud envs)
    ca = [process.env.KAFKA_CA_CERT.replace(/\\n/g, "\n")];
  } else if (process.env.KAFKA_CA_PATH) {
    try {
      const caPath = path.resolve(process.cwd(), process.env.KAFKA_CA_PATH);
      if (fs.existsSync(caPath)) {
        const caCert = fs.readFileSync(caPath, "utf-8");
        ca = [caCert];
      } else {
        logger.warn(`[Kafka Config] CA certificate file not found at path: ${caPath}`);
      }
    } catch (error: any) {
      logger.warn(`[Kafka Config] Failed to read CA certificate from path (${process.env.KAFKA_CA_PATH}): ${error.message}`);
    }
  }

  if (ca || !rejectUnauthorized) {
    sslConfig = {
      ...(ca ? { ca } : {}),
      rejectUnauthorized,
    };
  } else {
    sslConfig = true;
  }
}

const kafkaConfig: KafkaConfig = {
  clientId,
  brokers,
  ssl: sslConfig,
  sasl: saslConfig,
  logLevel: logLevel.NOTHING,
  retry: {
    initialRetryTime: 300,
    retries: 5,
  },
};

export const kafka = new Kafka(kafkaConfig);
