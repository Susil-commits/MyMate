import { Queue, Worker } from "bullmq";
import redisClient from "../config/redis.js";
import logger from "../config/logger.js";
import { transporter } from "../config/email.js";

export const emailQueue = redisClient
  ? new Queue("emailQueue", { connection: redisClient.duplicate({ maxRetriesPerRequest: null }) })
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
    { connection: redisClient.duplicate({ maxRetriesPerRequest: null }) }
  );
} else {
  logger.warn("Redis not configured. Email queue is disabled (falling back to inline).");
}
