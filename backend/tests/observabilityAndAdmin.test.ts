import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";

// Mock kafka and dependencies
jest.unstable_mockModule("../kafka/index.js", () => ({
  publishKafkaEvent: jest.fn().mockResolvedValue(undefined as never),
  isKafkaConnected: jest.fn().mockReturnValue(true),
  KAFKA_TOPICS: {
    BOOKING_CREATED: "mymate.booking.created",
    PAYMENT_COMPLETED: "mymate.payment.completed",
    DRIVER_KYC_STATUS: "mymate.driver.kyc_status",
    BOOKING_STATUS_CHANGED: "mymate.booking.status_changed",
  },
}));

const { correlationIdMiddleware } = await import("../middleware/correlationId.js");
const { getDriverWalletSplitPercentage } = await import("../config/platformSettings.js");
const {
  getAdminMetrics,
  softDeleteUser,
  softDeleteDriver,
} = await import("../controllers/adminController.js");
const { default: User } = await import("../models/User.js");
const { default: Driver } = await import("../models/Driver.js");
const { default: Booking } = await import("../models/Booking.js");
const { default: Payment } = await import("../models/Payment.js");

function createMockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((data: any) => {
    res.body = data;
    return res;
  });
  return res;
}

describe("Observability & Admin Enhancements (PHASE B & C)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Correlation ID Middleware (B.3)", () => {
    it("should generate X-Correlation-ID if header is missing", async () => {
      const app = express();
      app.use(correlationIdMiddleware);
      app.get("/test-corr", (req, res) => {
        res.json({ correlationId: req.correlationId });
      });

      const res = await request(app).get("/test-corr");
      expect(res.status).toBe(200);
      expect(res.headers["x-correlation-id"]).toBeDefined();
      expect(res.body.correlationId).toBe(res.headers["x-correlation-id"]);
    });

    it("should preserve existing incoming X-Correlation-ID header", async () => {
      const app = express();
      app.use(correlationIdMiddleware);
      app.get("/test-corr", (req, res) => {
        res.json({ correlationId: req.correlationId });
      });

      const customId = "client-trace-123456";
      const res = await request(app).get("/test-corr").set("X-Correlation-ID", customId);
      expect(res.status).toBe(200);
      expect(res.headers["x-correlation-id"]).toBe(customId);
      expect(res.body.correlationId).toBe(customId);
    });
  });

  describe("Wallet Split Percentage Configuration (C.1)", () => {
    const originalEnv = process.env.DRIVER_WALLET_SPLIT_PERCENTAGE;

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.DRIVER_WALLET_SPLIT_PERCENTAGE = originalEnv;
      } else {
        delete process.env.DRIVER_WALLET_SPLIT_PERCENTAGE;
      }
    });

    it("should return default 0.9 when env var is not set", () => {
      delete process.env.DRIVER_WALLET_SPLIT_PERCENTAGE;
      expect(getDriverWalletSplitPercentage()).toBe(0.9);
    });

    it("should return parsed percentage when valid env var is set", () => {
      process.env.DRIVER_WALLET_SPLIT_PERCENTAGE = "0.85";
      expect(getDriverWalletSplitPercentage()).toBe(0.85);
    });

    it("should fallback to 0.9 on invalid or out-of-range percentage", () => {
      process.env.DRIVER_WALLET_SPLIT_PERCENTAGE = "invalid";
      expect(getDriverWalletSplitPercentage()).toBe(0.9);

      process.env.DRIVER_WALLET_SPLIT_PERCENTAGE = "1.5";
      expect(getDriverWalletSplitPercentage()).toBe(0.9);
    });
  });

  describe("Admin Metrics Route Aggregation (C.2)", () => {
    it("should aggregate bookings by status, weekly revenue, and active drivers", async () => {
      jest.spyOn(Booking, "aggregate").mockResolvedValue([
        { status: "completed", count: 12, totalAmount: 15000 },
        { status: "cancelled", count: 2, totalAmount: 2000 },
      ] as any);

      jest.spyOn(Payment, "aggregate").mockResolvedValue([
        { year: 2026, week: 42, revenue: 15000, count: 12 },
      ] as any);

      jest.spyOn(Driver, "countDocuments").mockResolvedValue(5 as any);

      const req: any = { user: { role: "admin" } };
      const res = createMockRes();

      await getAdminMetrics(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.activeDriverCount).toBe(5);
      expect(res.body.data.bookingsByStatus.completed).toBe(12);
      expect(res.body.data.bookingsByStatus.cancelled).toBe(2);
      expect(res.body.data.revenueByWeek).toHaveLength(1);
    });
  });

  describe("Soft Delete Functionality (C.3)", () => {
    it("should soft delete a user and record audit log", async () => {
      const mockUser = {
        _id: "user-abc-123",
        email: "testuser@example.com",
        isActive: false,
        deletedAt: new Date(),
      };

      jest.spyOn(User, "findOneAndUpdate").mockResolvedValue(mockUser as any);

      const req: any = {
        params: { id: "user-abc-123" },
        user: { _id: "admin-1", role: "admin" },
        ip: "127.0.0.1",
      };
      const res = createMockRes();

      await softDeleteUser(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.deletedAt).toBeDefined();
      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "user-abc-123", deletedAt: null },
        expect.objectContaining({ isActive: false }),
        { new: true }
      );
    });

    it("should soft delete a driver and record audit log", async () => {
      const mockDriver = {
        _id: "driver-xyz-456",
        email: "driver@example.com",
        isActive: false,
        availability: "offline",
        deletedAt: new Date(),
      };

      jest.spyOn(Driver, "findOneAndUpdate").mockResolvedValue(mockDriver as any);

      const req: any = {
        params: { id: "driver-xyz-456" },
        user: { _id: "admin-1", role: "admin" },
        ip: "127.0.0.1",
      };
      const res = createMockRes();

      await softDeleteDriver(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.driver.deletedAt).toBeDefined();
      expect(Driver.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "driver-xyz-456", deletedAt: null },
        expect.objectContaining({ isActive: false, availability: "offline" }),
        { new: true }
      );
    });
  });
});
