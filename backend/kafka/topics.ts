export const KAFKA_TOPICS = {
  BOOKING_CREATED: "mymate.booking.created",
  BOOKING_STATUS_CHANGED: "mymate.booking.status_changed",
  PAYMENT_COMPLETED: "mymate.payment.completed",
  DRIVER_KYC_STATUS: "mymate.driver.kyc_status",
} as const;

export type KafkaTopic = typeof KAFKA_TOPICS[keyof typeof KAFKA_TOPICS];
