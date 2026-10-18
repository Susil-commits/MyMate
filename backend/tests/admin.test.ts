import { jest } from "@jest/globals";

// Mock kafka and events
jest.unstable_mockModule("../kafka/index.js", () => ({
  publishKafkaEvent: jest.fn().mockResolvedValue(undefined as never),
  KAFKA_TOPICS: {
    BOOKING_CREATED: "mymate.booking.created",
    PAYMENT_COMPLETED: "mymate.payment.completed",
    DRIVER_KYC_STATUS: "mymate.driver.kyc_status",
    BOOKING_STATUS_CHANGED: "mymate.booking.status_changed",
  },
}));

// Dynamic imports
const {
  verifyDriver,
  toggleDriverActive,
  toggleUserActive,
  getDashboardStats,
  getPendingDrivers,
  getDriverDetail,
} = await import("../controllers/adminController.js");

const { default: Driver } = await import("../models/Driver.js");
const { default: User } = await import("../models/User.js");
const { default: AuditLog } = await import("../models/AuditLog.js");
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

describe("Admin Controller Hardening & Audit Logging", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("verifyDriver (PUT /drivers/:id/verify)", () => {
    it("should reject invalid verification status", async () => {
      const req: any = {
        params: { id: "driver-123" },
        body: { status: "pending" }, // Only approved or rejected allowed
        user: { _id: "admin-1", role: "admin" },
        ip: "127.0.0.1",
      };
      const res = createMockRes();

      await verifyDriver(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Status must be approved or rejected");
    });

    it("should return 404 if driver not found", async () => {
      jest.spyOn(Driver, "findById").mockResolvedValueOnce(null);

      const req: any = {
        params: { id: "driver-nonexistent" },
        body: { status: "approved" },
        user: { _id: "admin-1", role: "admin" },
        ip: "127.0.0.1",
      };
      const res = createMockRes();

      await verifyDriver(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Driver not found");
    });

    it("should approve driver and record AuditLog", async () => {
      const mockDriver: any = {
        _id: "driver-123",
        kycStatus: "pending",
        isActive: false,
        availability: "offline",
        save: jest.fn().mockResolvedValue(true as never),
      };
      jest.spyOn(Driver, "findById").mockResolvedValueOnce(mockDriver);
      const auditCreateSpy = jest.spyOn(AuditLog, "create").mockResolvedValueOnce({} as any);

      const req: any = {
        params: { id: "driver-123" },
        body: { status: "approved" },
        user: { _id: "admin-1", role: "admin" },
        ip: "192.168.1.50",
      };
      const res = createMockRes();

      await verifyDriver(req, res);

      expect(mockDriver.kycStatus).toBe("approved");
      expect(mockDriver.isActive).toBe(true);
      expect(mockDriver.availability).toBe("available");
      expect(mockDriver.save).toHaveBeenCalled();

      expect(auditCreateSpy).toHaveBeenCalledWith({
        user: "admin-1",
        userType: "Admin",
        action: "VERIFY_DRIVER",
        details: { driverId: "driver-123", status: "approved" },
        ipAddress: "192.168.1.50",
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Driver verification status updated");
    });

    it("should reject driver and record AuditLog", async () => {
      const mockDriver: any = {
        _id: "driver-456",
        kycStatus: "pending",
        isActive: false,
        availability: "offline",
        save: jest.fn().mockResolvedValue(true as never),
      };
      jest.spyOn(Driver, "findById").mockResolvedValueOnce(mockDriver);
      const auditCreateSpy = jest.spyOn(AuditLog, "create").mockResolvedValueOnce({} as any);

      const req: any = {
        params: { id: "driver-456" },
        body: { status: "rejected" },
        user: { _id: "admin-1", role: "admin" },
        ip: "192.168.1.50",
      };
      const res = createMockRes();

      await verifyDriver(req, res);

      expect(mockDriver.kycStatus).toBe("rejected");
      expect(mockDriver.save).toHaveBeenCalled();
      expect(auditCreateSpy).toHaveBeenCalledWith({
        user: "admin-1",
        userType: "Admin",
        action: "VERIFY_DRIVER",
        details: { driverId: "driver-456", status: "rejected" },
        ipAddress: "192.168.1.50",
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("toggleDriverActive (PUT /drivers/:id/toggle-active)", () => {
    it("should return 404 if driver not found", async () => {
      jest.spyOn(Driver, "findById").mockResolvedValueOnce(null);

      const req: any = {
        params: { id: "driver-404" },
        user: { _id: "admin-1" },
        ip: "127.0.0.1",
      };
      const res = createMockRes();

      await toggleDriverActive(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Driver not found");
    });

    it("should toggle driver active state and record AuditLog", async () => {
      const mockDriver: any = {
        _id: "driver-789",
        isActive: true,
        save: jest.fn().mockResolvedValue(true as never),
      };
      jest.spyOn(Driver, "findById").mockResolvedValueOnce(mockDriver);
      const auditCreateSpy = jest.spyOn(AuditLog, "create").mockResolvedValueOnce({} as any);

      const req: any = {
        params: { id: "driver-789" },
        user: { _id: "admin-1" },
        ip: "10.0.0.1",
      };
      const res = createMockRes();

      await toggleDriverActive(req, res);

      expect(mockDriver.isActive).toBe(false);
      expect(mockDriver.save).toHaveBeenCalled();
      expect(auditCreateSpy).toHaveBeenCalledWith({
        user: "admin-1",
        userType: "Admin",
        action: "TOGGLE_DRIVER_ACTIVE",
        details: { driverId: "driver-789", isActive: false },
        ipAddress: "10.0.0.1",
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Driver status toggled");
    });
  });

  describe("toggleUserActive (PUT /users/:id/toggle-active)", () => {
    it("should return 404 if user not found", async () => {
      jest.spyOn(User, "findById").mockResolvedValueOnce(null);

      const req: any = {
        params: { id: "user-404" },
        user: { _id: "admin-1" },
        ip: "127.0.0.1",
      };
      const res = createMockRes();

      await toggleUserActive(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("User not found");
    });

    it("should toggle user active state and record AuditLog", async () => {
      const mockUser: any = {
        _id: "user-101",
        isActive: false,
        save: jest.fn().mockResolvedValue(true as never),
      };
      jest.spyOn(User, "findById").mockResolvedValueOnce(mockUser);
      const auditCreateSpy = jest.spyOn(AuditLog, "create").mockResolvedValueOnce({} as any);

      const req: any = {
        params: { id: "user-101" },
        user: { _id: "admin-1" },
        ip: "10.0.0.2",
      };
      const res = createMockRes();

      await toggleUserActive(req, res);

      expect(mockUser.isActive).toBe(true);
      expect(mockUser.save).toHaveBeenCalled();
      expect(auditCreateSpy).toHaveBeenCalledWith({
        user: "admin-1",
        userType: "Admin",
        action: "TOGGLE_USER_ACTIVE",
        details: { userId: "user-101", isActive: true },
        ipAddress: "10.0.0.2",
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("User status toggled");
    });
  });
});
