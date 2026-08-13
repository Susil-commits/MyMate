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
const { KAFKA_TOPICS } = await import("../kafka/topics.js");
const { publishKafkaEvent, initKafkaProducer, isKafkaProducerConnected } = await import("../kafka/producer.js");
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

describe("Kafka Connection Status", () => {
  it("should return true after successful producer connection", () => {
    expect(isKafkaProducerConnected()).toBe(true);
    expect(isKafkaConnected()).toBe(true);
  });
});
