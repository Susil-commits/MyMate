// ESM Jest requires jest.unstable_mockModule BEFORE any imports from the mocked module.
// This project uses --experimental-vm-modules for ESM support.

import { jest } from "@jest/globals";

const mockSend = jest.fn().mockResolvedValue(undefined);
const mockProducerConnect = jest.fn().mockResolvedValue(undefined);
const mockProducerDisconnect = jest.fn().mockResolvedValue(undefined);
const mockConsumerConnect = jest.fn().mockResolvedValue(undefined);
const mockConsumerDisconnect = jest.fn().mockResolvedValue(undefined);
const mockSubscribe = jest.fn().mockResolvedValue(undefined);
const mockRun = jest.fn().mockResolvedValue(undefined);
const mockAdminConnect = jest.fn().mockResolvedValue(undefined);
const mockAdminDisconnect = jest.fn().mockResolvedValue(undefined);
const mockListTopics = jest.fn().mockResolvedValue([]);
const mockCreateTopics = jest.fn().mockResolvedValue(true);

jest.unstable_mockModule("kafkajs", () => ({
  Kafka: jest.fn().mockImplementation(() => ({
    producer: () => ({
      connect: mockProducerConnect,
      disconnect: mockProducerDisconnect,
      send: mockSend,
    }),
    consumer: () => ({
      connect: mockConsumerConnect,
      disconnect: mockConsumerDisconnect,
      subscribe: mockSubscribe,
      run: mockRun,
    }),
    admin: () => ({
      connect: mockAdminConnect,
      disconnect: mockAdminDisconnect,
      listTopics: mockListTopics,
      createTopics: mockCreateTopics,
    }),
  })),
  logLevel: { NOTHING: 0 },
}));

// Dynamic imports AFTER mocks are set up
const { KAFKA_TOPICS, getDlqTopic } = await import("../kafka/topics.js");
const { publishKafkaEvent, publishKafkaDlq, initKafkaProducer, isKafkaProducerConnected } = await import("../kafka/producer.js");
const { isKafkaConnected } = await import("../kafka/index.js");

// Initialize producer (will use mocked Kafka)
await initKafkaProducer();

describe("Kafka Topic Definitions", () => {
  it("should have all four required topic names", () => {
    expect(KAFKA_TOPICS.BOOKING_CREATED).toBe("mymate.booking.created");
    expect(KAFKA_TOPICS.BOOKING_STATUS_CHANGED).toBe("mymate.booking.status_changed");
    expect(KAFKA_TOPICS.PAYMENT_COMPLETED).toBe("mymate.payment.completed");
    expect(KAFKA_TOPICS.DRIVER_KYC_STATUS).toBe("mymate.driver.kyc_status");
  });

  it("should have DLQ topics for error routing", () => {
    expect(KAFKA_TOPICS.BOOKING_CREATED_DLQ).toBe("mymate.booking.created.dlq");
    expect(KAFKA_TOPICS.BOOKING_STATUS_CHANGED_DLQ).toBe("mymate.booking.status_changed.dlq");
    expect(KAFKA_TOPICS.PAYMENT_COMPLETED_DLQ).toBe("mymate.payment.completed.dlq");
    expect(KAFKA_TOPICS.DRIVER_KYC_STATUS_DLQ).toBe("mymate.driver.kyc_status.dlq");
  });

  it("getDlqTopic helper should append .dlq suffix", () => {
    expect(getDlqTopic(KAFKA_TOPICS.BOOKING_CREATED)).toBe("mymate.booking.created.dlq");
    expect(getDlqTopic("custom.topic")).toBe("custom.topic.dlq");
  });

  it("all topic values should be namespaced with 'mymate.'", () => {
    Object.values(KAFKA_TOPICS).forEach((topic) => {
      expect(topic).toMatch(/^mymate\./);
    });
  });
});

describe("Kafka Producer", () => {
  beforeEach(() => {
    mockSend.mockClear();
  });

  it("should return true after publishing successfully", async () => {
    const result = await publishKafkaEvent(
      KAFKA_TOPICS.BOOKING_CREATED,
      "booking-abc-123",
      { bookingId: "abc-123", hireType: "temporary" }
    );
    expect(result).toBe(true);
  });

  it("should call producer.send with the correct topic", async () => {
    await publishKafkaEvent(
      KAFKA_TOPICS.PAYMENT_COMPLETED,
      "payment-xyz-456",
      { paymentId: "xyz-456", amount: 500 }
    );
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: KAFKA_TOPICS.PAYMENT_COMPLETED,
      })
    );
  });

  it("should call producer.send with the correct key and JSON-serialized value", async () => {
    const payload = { driverId: "driver-001", status: "approved" };
    await publishKafkaEvent(KAFKA_TOPICS.DRIVER_KYC_STATUS, "driver-001", payload);

    const call = mockSend.mock.calls.at(-1)![0] as any;
    expect(call.messages[0].key).toBe("driver-001");
    expect(JSON.parse(call.messages[0].value)).toMatchObject(payload);
  });

  it("should include a numeric timestamp on published messages", async () => {
    await publishKafkaEvent(
      KAFKA_TOPICS.BOOKING_STATUS_CHANGED,
      "booking-ts-test",
      { status: "accepted" }
    );
    const call = mockSend.mock.calls.at(-1)![0] as any;
    expect(Number(call.messages[0].timestamp)).toBeGreaterThan(0);
  });

  it("should return false when producer.send throws an error", async () => {
    mockSend.mockRejectedValueOnce(new Error("Broker unavailable"));
    const result = await publishKafkaEvent(
      KAFKA_TOPICS.BOOKING_CREATED,
      "failing-key",
      { test: true }
    );
    expect(result).toBe(false);
  });
});

describe("Kafka Dead-Letter Queue (DLQ)", () => {
  beforeEach(() => {
    mockSend.mockClear();
  });

  it("should route failed message to *.dlq topic with full error metadata", async () => {
    const error = new Error("Failed to process driver notification");
    const originalPayload = { bookingId: "book-123", amount: 450 };

    const result = await publishKafkaDlq(
      KAFKA_TOPICS.BOOKING_CREATED,
      "book-123",
      JSON.stringify(originalPayload),
      error,
      0,
      "42"
    );

    expect(result).toBe(true);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "mymate.booking.created.dlq",
      })
    );

    const call = mockSend.mock.calls.at(-1)![0] as any;
    expect(call.messages[0].key).toBe("book-123");

    const dlqMessage = JSON.parse(call.messages[0].value);
    expect(dlqMessage.originalTopic).toBe(KAFKA_TOPICS.BOOKING_CREATED);
    expect(dlqMessage.partition).toBe(0);
    expect(dlqMessage.offset).toBe("42");
    expect(dlqMessage.payload).toEqual(originalPayload);
    expect(dlqMessage.error.message).toBe("Failed to process driver notification");
    expect(dlqMessage.failedAt).toBeDefined();
  });

  it("should handle non-JSON string payloads gracefully in DLQ", async () => {
    const error = new Error("Malformed JSON payload");
    const rawPayload = "not-a-json-string";

    await publishKafkaDlq(
      KAFKA_TOPICS.PAYMENT_COMPLETED,
      "pay-999",
      rawPayload,
      error
    );

    const call = mockSend.mock.calls.at(-1)![0] as any;
    const dlqMessage = JSON.parse(call.messages[0].value);
    expect(dlqMessage.payload).toBe("not-a-json-string");
    expect(dlqMessage.error.message).toBe("Malformed JSON payload");
  });

  it("should fallback to 'dlq-fallback' key when key is null or undefined", async () => {
    await publishKafkaDlq(
      KAFKA_TOPICS.DRIVER_KYC_STATUS,
      null,
      { test: 1 },
      new Error("Unknown error")
    );

    const call = mockSend.mock.calls.at(-1)![0] as any;
    expect(call.messages[0].key).toBe("dlq-fallback");
  });
});

describe("Kafka Connection Status", () => {
  it("should return true after successful producer connection", () => {
    expect(isKafkaProducerConnected()).toBe(true);
    expect(isKafkaConnected()).toBe(true);
  });
});
