// @ts-nocheck
import Driver from "../models/Driver.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";
import { clampLimit } from "../utils/sanitize.js";
import { buildPagination } from "../utils/pagination.js";
import { createNotification } from "../models/Notification.js";
import { sendKycStatusEmail } from "../config/email.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { logAudit } from "../controllers/auditController.js";

export const getDashboardStats = async (req, res) => {
  const [
    totalDrivers, activeDrivers, totalUsers, totalBookings, pendingKyc,
    completedBookings, cancelledBookings, revenueAgg,
  ] = await Promise.all([
    Driver.countDocuments(),
    Driver.countDocuments({ isActive: true, kycStatus: "approved" }),
    User.countDocuments(),
    Booking.countDocuments(),
    Driver.countDocuments({ kycStatus: "pending" }),
    Booking.countDocuments({ status: "completed" }),
    Booking.countDocuments({ status: { $in: ["cancelled", "rejected"] } }),
    Payment.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, revenue: { $sum: "$amount" } } },
    ]),
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

export const getAllDrivers = async (req, res) => {
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

export const getPendingDrivers = async (req, res) => {
  const drivers = await Driver.find({ kycStatus: "pending", profileCompleted: true }).sort({
    updatedAt: -1,
  });
  return ApiResponse.success(res, { drivers }, "Pending drivers retrieved");
};

export const getDriverDetail = async (req, res) => {
  const driver = await Driver.findById(req.params.id);
  if (!driver) return ApiResponse.error(res, "Driver not found", 404);
  return ApiResponse.success(res, { driver }, "Driver detail retrieved");
};

export const verifyDriver = async (req, res) => {
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

  sendKycStatusEmail(driver, status).catch(() => {});
  createNotification({
    userId: driver._id,
    userModel: "Driver",
    title: "KYC Verification Update",
    message:
      status === "approved"
        ? "Your KYC has been approved. You are now live on the platform."
        : "Your KYC was rejected. Please update your documents and resubmit.",
    type: "kyc",
    link: "/driver/profile",
  }).catch(() => {});

  logAudit(req.user, "Admin", "VERIFY_DRIVER", { driverId: driver._id, status }, req.ip);

  return ApiResponse.success(res, { driver }, "Driver verification status updated");
};

export const toggleDriverActive = async (req, res) => {
  const driver = await Driver.findById(req.params.id);
  if (!driver) return ApiResponse.error(res, "Driver not found", 404);
  driver.isActive = !driver.isActive;
  await driver.save();
  logAudit(req.user, "Admin", "TOGGLE_DRIVER_ACTIVE", { driverId: driver._id, isActive: driver.isActive }, req.ip);
  return ApiResponse.success(res, { driver }, "Driver status toggled");
};

export const getAllUsers = async (req, res) => {
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

export const toggleUserActive = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return ApiResponse.error(res, "User not found", 404);
  user.isActive = !user.isActive;
  await user.save();
  logAudit(req.user, "Admin", "TOGGLE_USER_ACTIVE", { userId: user._id, isActive: user.isActive }, req.ip);
  return ApiResponse.success(res, { user }, "User status toggled");
};

export const getAllBookings = async (req, res) => {
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

export const exportBookingsCSV = async (req, res) => {
  const bookings = await Booking.find().populate("user", "name").populate("driver", "name").sort({ createdAt: -1 });
  let csv = "ID,User,Driver,Status,Amount,Date\\n";
  bookings.forEach(b => {
    csv += `"${b._id}","${b.user?.name || ''}","${b.driver?.name || ''}","${b.status}","${b.amount}","${b.createdAt}"\\n`;
  });
  
  res.header("Content-Type", "text/csv");
  res.attachment("bookings.csv");
  return res.send(csv);
};
