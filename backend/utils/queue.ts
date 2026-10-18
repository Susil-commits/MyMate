import { Queue, Worker } from "bullmq";
import redisClient from "../config/redis.js";
import logger from "../config/logger.js";
import { transporter } from "../config/email.js";

const isQueueEnabled = Boolean(redisClient && process.env.DISABLE_QUEUE !== "true");

const getBullConnection = () => {
  if (!isQueueEnabled || !redisClient) return null;
  const client = redisClient.duplicate({ maxRetriesPerRequest: null });
  // Attach an error handler to prevent Node from throwing unhandled 'error' events
  // when Redis is unreachable or rate limited.
  client.on("error", (err) => {
    logger.warn(`[BullMQ Redis Connection] ${err.message}`);
  });
  return client;
};

export const emailQueue = isQueueEnabled
  ? new Queue("emailQueue", { connection: getBullConnection()! })
  : null;

if (emailQueue) {
  emailQueue.on("error", (err) => {
    logger.warn(`[BullMQ Queue] ${err.message}`);
  });
}

if (isQueueEnabled) {
  const worker = new Worker(
    "emailQueue",
    async (job) => {
      const { to, subject, html, text } = job.data;
      if (!transporter) return;

      const info = await transporter.sendMail({
        from: `"MyMate" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text,
        html,
      });
      logger.info(`Email sent via Queue: ${info.messageId}`);
    },
    { connection: getBullConnection()! }
  );

  worker.on("error", (err) => {
    logger.warn(`[BullMQ Worker] ${err.message}`);
  });
} else {
  logger.warn("Redis/Queue not configured or disabled. Email queue is disabled (falling back to inline).");
}

