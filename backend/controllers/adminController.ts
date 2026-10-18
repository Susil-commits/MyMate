import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import Driver from "../models/Driver.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";
import { clampLimit } from "../utils/sanitize.js";
import { buildPagination } from "../utils/pagination.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import AuditLog from "../models/AuditLog.js";
import { eventBus } from "../events/bookingEvents.js";
import { publishKafkaEvent, KAFKA_TOPICS } from "../kafka/index.js";


export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  const [
    totalDrivers, activeDrivers, totalUsers, totalBookings, pendingKyc,
    completedBookings, cancelledBookings, revenueAgg,
  ] = await Promise.all([
    Driver.countDocuments().read('secondaryPreferred'),
    Driver.countDocuments({ isActive: true, kycStatus: "approved" }).read('secondaryPreferred'),
    User.countDocuments().read('secondaryPreferred'),
    Booking.countDocuments().read('secondaryPreferred'),
    Driver.countDocuments({ kycStatus: "pending" }).read('secondaryPreferred'),
    Booking.countDocuments({ status: "completed" }).read('secondaryPreferred'),
    Booking.countDocuments({ status: { $in: ["cancelled", "rejected"] } }).read('secondaryPreferred'),
    Payment.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, revenue: { $sum: "$amount" } } },
    ]).read('secondaryPreferred'),
  ]);
  return ApiResponse.success(res, {
    totalDrivers,
    activeDrivers,
    totalUsers,
    totalBookings,
    pendingKyc,
    completedBookings,
    cancelledBookings,
    revenue: revenueAgg[0]?.revenue || 0,
  }, "Dashboard stats retrieved");
};

export const getAllDrivers = async (req: AuthRequest, res: Response) => {
  const { kycStatus, page, limit } = req.query;
  const filter: any = {};
  if (kycStatus) filter.kycStatus = kycStatus;
  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = clampLimit(limit, 20, 100);
  const skip = (pageNum - 1) * limitNum;
  const [total, drivers] = await Promise.all([
    Driver.countDocuments(filter),
    Driver.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
  ]);
  return ApiResponse.success(res, { drivers, pagination: buildPagination(total, pageNum, limitNum) }, "Drivers retrieved");
};

export const getPendingDrivers = async (req: AuthRequest, res: Response) => {
  const drivers = await Driver.find({ kycStatus: "pending", profileCompleted: true }).sort({
    updatedAt: -1,
  });
  return ApiResponse.success(res, { drivers }, "Pending drivers retrieved");
};

export const getDriverDetail = async (req: AuthRequest, res: Response) => {
  const driver = await Driver.findById(req.params.id);
  if (!driver) return ApiResponse.error(res, "Driver not found", 404);
  return ApiResponse.success(res, { driver }, "Driver detail retrieved");
};

export const verifyDriver = async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  if (!["approved", "rejected"].includes(status)) {
    return ApiResponse.error(res, "Status must be approved or rejected", 400);
  }
  const driver = await Driver.findById(req.params.id);
  if (!driver) return ApiResponse.error(res, "Driver not found", 404);
  driver.kycStatus = status;
  if (status === "approved") {
    driver.isActive = true;
    driver.availability = "available";
  }
  await driver.save();

  eventBus.emit("DRIVER_VERIFIED", { driver, status });

  publishKafkaEvent(KAFKA_TOPICS.DRIVER_KYC_STATUS, String(driver._id), {
    driverId: driver._id,
    status,
  }).catch(() => {});

  await AuditLog.create({
    user: (req.user as any)?._id,
    userType: "Admin",
    action: "VERIFY_DRIVER",
    details: { driverId: driver._id, status },
    ipAddress: req.ip || "unknown",
  }).catch(() => {});


  return ApiResponse.success(res, { driver }, "Driver verification status updated");
};

export const toggleDriverActive = async (req: AuthRequest, res: Response) => {
  const driver = await Driver.findById(req.params.id);
  if (!driver) return ApiResponse.error(res, "Driver not found", 404);
  driver.isActive = !driver.isActive;
  await driver.save();
  await AuditLog.create({
    user: (req.user as any)?._id,
    userType: "Admin",
    action: "TOGGLE_DRIVER_ACTIVE",
    details: { driverId: driver._id, isActive: driver.isActive },
    ipAddress: req.ip || "unknown",
  }).catch(() => {});
  return ApiResponse.success(res, { driver }, "Driver status toggled");
};

export const getAllUsers = async (req: AuthRequest, res: Response) => {
  const { page, limit } = req.query;
  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = clampLimit(limit, 20, 100);
  const skip = (pageNum - 1) * limitNum;
  const [total, users] = await Promise.all([
    User.countDocuments(),
    User.find().sort({ createdAt: -1 }).skip(skip).limit(limitNum),
  ]);
  return ApiResponse.success(res, { users, pagination: buildPagination(total, pageNum, limitNum) }, "Users retrieved");
};

export const toggleUserActive = async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) return ApiResponse.error(res, "User not found", 404);
  user.isActive = !user.isActive;
  await user.save();
  await AuditLog.create({
    user: (req.user as any)?._id,
    userType: "Admin",
    action: "TOGGLE_USER_ACTIVE",
    details: { userId: user._id, isActive: user.isActive },
    ipAddress: req.ip || "unknown",
  }).catch(() => {});
  return ApiResponse.success(res, { user }, "User status toggled");
};

export const getAllBookings = async (req: AuthRequest, res: Response) => {
  const { status, page, limit } = req.query;
  const filter: any = {};
  if (status) filter.status = status;
  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = clampLimit(limit, 20, 100);
  const skip = (pageNum - 1) * limitNum;
  const [total, bookings] = await Promise.all([
    Booking.countDocuments(filter),
    Booking.find(filter)
      .populate("user", "name")
      .populate("driver", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
  ]);
  return ApiResponse.success(res, { bookings, pagination: buildPagination(total, pageNum, limitNum) }, "Bookings retrieved");
};

export const exportBookingsCSV = async (req: AuthRequest, res: Response) => {
  // Stream bookings row-by-row via cursor to maintain low memory footprint
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=\"bookings.csv\"");

  // Write header row
  res.write("ID,User,Driver,Status,Amount,Date\n");

  const cursor = Booking.find()
    .populate("user", "name")
    .populate("driver", "name")
    .sort({ createdAt: -1 })
    .cursor();

  for await (const b of cursor) {
    const row = [
      `"${b._id}"`,
      `"${(b.user as any)?.name || ""}"`,
      `"${(b.driver as any)?.name || ""}"`,
      `"${b.status}"`,
      `"${(b as any).totalAmount}"`,
      `"${b.createdAt}"`,
    ].join(",");
    res.write(row + "\n");
  }

  res.end();
};

export const getAdminHeatmap = async (req: AuthRequest, res: Response) => {
  // Try to get actual coordinates from recent bookings and active drivers
  const activeDrivers = await Driver.find({ isActive: true, location: { $exists: true } }).select("location").read('secondaryPreferred');
  const recentBookings = await Booking.find({ pickupCoordinates: { $exists: true } }).sort({ createdAt: -1 }).limit(100).select("pickupCoordinates").read('secondaryPreferred');

  const heatPoints: [number, number, number][] = [];

  activeDrivers.forEach(d => {
    if (d.location?.coordinates && d.location.coordinates.length === 2) {
      heatPoints.push([d.location.coordinates[1], d.location.coordinates[0], 0.6]); // Moderate intensity for drivers
    }
  });

  recentBookings.forEach(b => {
    if ((b as any).pickupCoordinates?.lat && (b as any).pickupCoordinates?.lng) {
      heatPoints.push([(b as any).pickupCoordinates.lat, (b as any).pickupCoordinates.lng, 1.0]); // High intensity for bookings
    }
  });

  // If no data exists yet (due to legacy data), fallback to mock data around Mumbai for demo purposes
  if (heatPoints.length === 0) {
    const baseLat = 19.0760;
    const baseLng = 72.8777;
    for(let i = 0; i < 50; i++) {
        const lat = baseLat + (Math.random() - 0.5) * 0.1;
        const lng = baseLng + (Math.random() - 0.5) * 0.1;
        const intensity = Math.random() * 0.8 + 0.2;
        heatPoints.push([lat, lng, intensity]);
    }
  }

  return ApiResponse.success(res, { heatPoints }, "Heatmap data retrieved");
};
