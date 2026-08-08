import { Queue, Worker } from "bullmq";
import redisClient from "../config/redis.js";
import logger from "../config/logger.js";
import { transporter } from "../config/email.js";

const getBullConnection = () => {
  if (!redisClient) return null;
  const client = redisClient.duplicate({ maxRetriesPerRequest: null });
  // Attach an error handler to prevent Node from throwing unhandled 'error' events
  // when Redis is unreachable.
  client.on("error", () => {});
  return client;
};

export const emailQueue = redisClient
  ? new Queue("emailQueue", { connection: getBullConnection()! })
  : null;

if (redisClient) {
  new Worker(
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
} else {
  logger.warn("Redis not configured. Email queue is disabled (falling back to inline).");
}

