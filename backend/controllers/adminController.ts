// @ts-nocheck
import Driver from "../models/Driver.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";
import { clampLimit } from "../utils/sanitize.js";
import { buildPagination } from "../utils/pagination.js";
import { createNotification } from "../models/Notification.js";
import { sendKycStatusEmail } from "../config/email.js";

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
  res.json({
    totalDrivers,
    activeDrivers,
    totalUsers,
    totalBookings,
    pendingKyc,
    completedBookings,
    cancelledBookings,
    revenue: revenueAgg[0]?.revenue || 0,
  });
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
  res.json({ drivers, pagination: buildPagination(total, pageNum, limitNum) });
};

export const getPendingDrivers = async (req, res) => {
  const drivers = await Driver.find({ kycStatus: "pending", profileCompleted: true }).sort({
    updatedAt: -1,
  });
  res.json({ drivers });
};

export const getDriverDetail = async (req, res) => {
  const driver = await Driver.findById(req.params.id);
  if (!driver) return res.status(404).json({ message: "Driver not found" });
  res.json({ driver });
};

export const verifyDriver = async (req, res) => {
  const { status } = req.body;
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Status must be approved or rejected" });
  }
  const driver = await Driver.findById(req.params.id);
  if (!driver) return res.status(404).json({ message: "Driver not found" });
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

  res.json({ driver });
};

export const toggleDriverActive = async (req, res) => {
  const driver = await Driver.findById(req.params.id);
  if (!driver) return res.status(404).json({ message: "Driver not found" });
  driver.isActive = !driver.isActive;
  await driver.save();
  res.json({ driver });
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
  res.json({ users, pagination: buildPagination(total, pageNum, limitNum) });
};

export const toggleUserActive = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  user.isActive = !user.isActive;
  await user.save();
  res.json({ user });
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
  res.json({ bookings, pagination: buildPagination(total, pageNum, limitNum) });
};
