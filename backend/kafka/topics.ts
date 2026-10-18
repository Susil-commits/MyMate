export const KAFKA_TOPICS = {
  BOOKING_CREATED: "mymate.booking.created",
  BOOKING_STATUS_CHANGED: "mymate.booking.status_changed",
  PAYMENT_COMPLETED: "mymate.payment.completed",
  DRIVER_KYC_STATUS: "mymate.driver.kyc_status",

  // Dead Letter Queue (DLQ) Topics
  BOOKING_CREATED_DLQ: "mymate.booking.created.dlq",
  BOOKING_STATUS_CHANGED_DLQ: "mymate.booking.status_changed.dlq",
  PAYMENT_COMPLETED_DLQ: "mymate.payment.completed.dlq",
  DRIVER_KYC_STATUS_DLQ: "mymate.driver.kyc_status.dlq",
} as const;

export type KafkaTopic = typeof KAFKA_TOPICS[keyof typeof KAFKA_TOPICS];

/**
 * Returns the standard Dead-Letter Queue (DLQ) topic name for a given event topic.
 */
export const getDlqTopic = (topic: string): string => {
  return `${topic}.dlq`;
};
