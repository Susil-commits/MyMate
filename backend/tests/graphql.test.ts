import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";

const { resolvers, typeDefs } = await import("../graphql/schema.js");
const { verifyAndResolveUser } = await import("../middleware/auth.js");
const Booking = (await import("../models/Booking.js")).default;
const Driver = (await import("../models/Driver.js")).default;
const User = (await import("../models/User.js")).default;
const Admin = (await import("../models/Admin.js")).default;

describe("GraphQL Security and Authentication Tests", () => {
  const userId = "507f1f77bcf86cd799439011";
  const otherUserId = "507f1f77bcf86cd799439012";
  const driverId = "507f1f77bcf86cd799439021";
  const otherDriverId = "507f1f77bcf86cd799439022";
  const adminId = "507f1f77bcf86cd799439031";

  const userContext: any = {
    user: { _id: userId, role: "user" },
    userRole: "user",
  };

  const driverContext: any = {
    user: { _id: driverId, role: "driver" },
    userRole: "driver",
  };

  const adminContext: any = {
    user: { _id: adminId, role: "admin" },
    userRole: "admin",
  };

  const unauthContext: any = {
    user: null,
    userRole: null,
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("1. Query.bookings authentication & scoping", () => {
    it("should reject unauthenticated requests with UNAUTHENTICATED error", async () => {
      await expect(
        resolvers.Query.bookings(null, { limit: 100 }, unauthContext)
      ).rejects.toThrow("Authentication required to access bookings");
    });

    it("should scope bookings to user id for regular users", async () => {
      const mockQuery: any = {
        read: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: "b1", user: userId }]),
      };
      const findSpy = jest.spyOn(Booking, "find").mockReturnValue(mockQuery);

      const result = await resolvers.Query.bookings(null, { limit: 20 }, userContext);

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({ user: userId })
      );
      expect(mockQuery.limit).toHaveBeenCalledWith(20);
      expect(result).toHaveLength(1);
    });

    it("should scope bookings to driver id for driver users", async () => {
      const mockQuery: any = {
        read: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: "b2", driver: driverId }]),
      };
      const findSpy = jest.spyOn(Booking, "find").mockReturnValue(mockQuery);

      const result = await resolvers.Query.bookings(null, { status: "ongoing" }, driverContext);

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({ driver: driverId, status: "ongoing" })
      );
      expect(result).toHaveLength(1);
    });

    it("should allow admins to query all bookings with clamped limit", async () => {
      const mockQuery: any = {
        read: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: "b1" }, { _id: "b2" }]),
      };
      const findSpy = jest.spyOn(Booking, "find").mockReturnValue(mockQuery);

      // Client requests limit: 1000 — must be clamped to 50 max
      const result = await resolvers.Query.bookings(null, { limit: 1000 }, adminContext);

      expect(findSpy).toHaveBeenCalledWith({});
      expect(mockQuery.limit).toHaveBeenCalledWith(50);
      expect(result).toHaveLength(2);
    });
  });

  describe("2. Query.booking(id) authorization", () => {
    it("should reject unauthenticated requests with UNAUTHENTICATED error", async () => {
      await expect(
        resolvers.Query.booking(null, { id: "b123" }, unauthContext)
      ).rejects.toThrow("Authentication required to access booking details");
    });

    it("should return null if booking is not found", async () => {
      jest.spyOn(Booking, "findById").mockReturnValue({
        read: jest.fn().mockResolvedValue(null),
      } as any);

      const result = await resolvers.Query.booking(null, { id: "nonexistent" }, userContext);
      expect(result).toBeNull();
    });

    it("should allow booking owner (user) to view booking", async () => {
      const mockBooking = { _id: "b1", user: userId, driver: driverId, status: "completed" };
      jest.spyOn(Booking, "findById").mockReturnValue({
        read: jest.fn().mockResolvedValue(mockBooking),
      } as any);

      const result = await resolvers.Query.booking(null, { id: "b1" }, userContext);
      expect(result).toEqual(mockBooking);
    });

    it("should allow assigned driver to view booking", async () => {
      const mockBooking = { _id: "b1", user: userId, driver: driverId, status: "ongoing" };
      jest.spyOn(Booking, "findById").mockReturnValue({
        read: jest.fn().mockResolvedValue(mockBooking),
      } as any);

      const result = await resolvers.Query.booking(null, { id: "b1" }, driverContext);
      expect(result).toEqual(mockBooking);
    });

    it("should allow admin to view any booking", async () => {
      const mockBooking = { _id: "b1", user: userId, driver: driverId, status: "pending" };
      jest.spyOn(Booking, "findById").mockReturnValue({
        read: jest.fn().mockResolvedValue(mockBooking),
      } as any);

      const result = await resolvers.Query.booking(null, { id: "b1" }, adminContext);
      expect(result).toEqual(mockBooking);
    });

    it("should reject unrelated user with FORBIDDEN error", async () => {
      const mockBooking = { _id: "b1", user: otherUserId, driver: otherDriverId };
      jest.spyOn(Booking, "findById").mockReturnValue({
        read: jest.fn().mockResolvedValue(mockBooking),
      } as any);

      await expect(
        resolvers.Query.booking(null, { id: "b1" }, userContext)
      ).rejects.toThrow("Forbidden: Not authorized to view this booking");
    });
  });

  describe("3. Query.drivers & Query.driver access control", () => {
    it("should enforce active and KYC-approved filter for public/non-admin users", async () => {
      const mockQuery: any = {
        read: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: driverId, name: "Driver Bob" }]),
      };
      const findSpy = jest.spyOn(Driver, "find").mockReturnValue(mockQuery);

      await resolvers.Query.drivers(null, { isActive: false, kycStatus: "pending" }, unauthContext);

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true, kycStatus: "approved" })
      );
    });

    it("should allow admin to filter by inactive or unapproved status", async () => {
      const mockQuery: any = {
        read: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      const findSpy = jest.spyOn(Driver, "find").mockReturnValue(mockQuery);

      await resolvers.Query.drivers(null, { isActive: false, kycStatus: "pending" }, adminContext);

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, kycStatus: "pending" })
      );
    });

    it("should hide unapproved driver in driver(id) for non-admins", async () => {
      const unapprovedDriver = { _id: driverId, isActive: true, kycStatus: "pending" };
      jest.spyOn(Driver, "findById").mockReturnValue({
        read: jest.fn().mockResolvedValue(unapprovedDriver),
      } as any);

      const result = await resolvers.Query.driver(null, { id: driverId }, userContext);
      expect(result).toBeNull();
    });

    it("should allow admin to inspect unapproved driver in driver(id)", async () => {
      const unapprovedDriver = { _id: driverId, isActive: false, kycStatus: "rejected" };
      jest.spyOn(Driver, "findById").mockReturnValue({
        read: jest.fn().mockResolvedValue(unapprovedDriver),
      } as any);

      const result = await resolvers.Query.driver(null, { id: driverId }, adminContext);
      expect(result).toEqual(unapprovedDriver);
    });
  });

  describe("4. Field resolvers & privacy protection", () => {
    it("should hide driver email from public and unrelated users", () => {
      const parent = { _id: driverId, email: "driver@example.com" };

      expect(resolvers.Driver.email(parent, {}, unauthContext)).toBeNull();
      expect(resolvers.Driver.email(parent, {}, userContext)).toBeNull();
    });

    it("should allow the driver themselves or an admin to view email", () => {
      const parent = { _id: driverId, email: "driver@example.com" };

      expect(resolvers.Driver.email(parent, {}, driverContext)).toBe("driver@example.com");
      expect(resolvers.Driver.email(parent, {}, adminContext)).toBe("driver@example.com");
    });

    it("should resolve booking userId and driverId correctly", () => {
      const parentPopulated = {
        _id: "b1",
        user: { _id: userId, name: "Alice" },
        driver: { _id: driverId, name: "Bob" },
      };
      expect(resolvers.Booking.userId(parentPopulated)).toBe(userId);
      expect(resolvers.Booking.driverId(parentPopulated)).toBe(driverId);

      const parentIds = {
        _id: "b2",
        user: userId,
        driver: driverId,
      };
      expect(resolvers.Booking.userId(parentIds)).toBe(userId);
      expect(resolvers.Booking.driverId(parentIds)).toBe(driverId);
    });
  });

  describe("5. verifyAndResolveUser token authentication", () => {
    const originalSecret = process.env.JWT_SECRET;
    beforeAll(() => {
      process.env.JWT_SECRET = "test_graphql_secret_key";
    });
    afterAll(() => {
      process.env.JWT_SECRET = originalSecret;
    });

    it("should return null user if no token provided", async () => {
      const res = await verifyAndResolveUser();
      expect(res.user).toBeNull();
      expect(res.userRole).toBeNull();
      expect(res.error).toBe("Not authorized, no token");
    });

    it("should resolve valid user token", async () => {
      const token = jwt.sign({ id: userId, role: "user" }, process.env.JWT_SECRET as string);
      jest.spyOn(User, "findById").mockReturnValue({
        select: jest.fn().mockResolvedValue({ _id: userId, name: "Alice", isActive: true }),
      } as any);

      const res = await verifyAndResolveUser(token);
      expect(res.userRole).toBe("user");
      expect(res.user?._id).toBe(userId);
      expect(res.error).toBeUndefined();
    });

    it("should reject token with mismatched tokenVersion", async () => {
      const token = jwt.sign({ id: userId, role: "user", tv: 1 }, process.env.JWT_SECRET as string);
      jest.spyOn(User, "findById").mockReturnValue({
        select: jest.fn().mockResolvedValue({ _id: userId, tokenVersion: 2, isActive: true }),
      } as any);

      const res = await verifyAndResolveUser(token);
      expect(res.user).toBeNull();
      expect(res.error).toBe("Session expired. Please log in again.");
    });

    it("should reject deactivated user accounts", async () => {
      const token = jwt.sign({ id: userId, role: "user" }, process.env.JWT_SECRET as string);
      jest.spyOn(User, "findById").mockReturnValue({
        select: jest.fn().mockResolvedValue({ _id: userId, isActive: false }),
      } as any);

      const res = await verifyAndResolveUser(token);
      expect(res.user).toBeNull();
      expect(res.error).toBe("Your account has been deactivated");
    });
  });
});
