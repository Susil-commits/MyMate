import Driver from "../models/Driver.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";
import { createNotification } from "../models/Notification.js";
import { sendKycStatusEmail } from "../config/email.js";
import { clampLimit } from "../utils/sanitize.js";

export const getPendingDrivers = async (req, res, next) => {
  try {
    const drivers = await Driver.find({ profileCompleted: true, kycStatus: "pending" })
      .sort({ createdAt: -1 })
      .select("-password");
    res.json({ drivers });
  } catch (error) {
    next(error);
  }
};

export const verifyDriver = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be approved or rejected" });
    }

    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      {
        kycStatus: status,
        isActive: status === "approved",
        availability: status === "approved" ? "available" : "offline",
      },
      { new: true }
    ).select("-password");

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    sendKycStatusEmail(driver, status).catch(() => {});
    createNotification({
      userId: driver._id,
      userModel: "Driver",
      title: `KYC ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: status === "approved" ? "Your documents have been verified. You're now live!" : "Your KYC was rejected. Please update your documents.",
      type: "kyc",
      link: "/driver/profile",
    }).catch(() => {});

    res.json({ driver });
  } catch (error) {
    next(error);
  }
};

export const getAllDrivers = async (req, res, next) => {
  try {
    const { kycStatus, page = 1, limit = 20 } = req.query;
    const safeLimit = clampLimit(limit, 20, 100);
    const query = {};
    if (kycStatus) query.kycStatus = kycStatus;

    const skip = (Number(page) - 1) * safeLimit;
    const [drivers, total] = await Promise.all([
      Driver.find(query).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).select("-password"),
      Driver.countDocuments(query),
    ]);

    res.json({ drivers, pagination: { page: Number(page), pages: Math.ceil(total / safeLimit), total } });
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const safeLimit = clampLimit(limit, 20, 100);
    const skip = (Number(page) - 1) * safeLimit;
    const [users, total] = await Promise.all([
      User.find().sort({ createdAt: -1 }).skip(skip).limit(safeLimit).select("-password"),
      User.countDocuments(),
    ]);

    res.json({ users, pagination: { page: Number(page), pages: Math.ceil(total / safeLimit), total } });
  } catch (error) {
    next(error);
  }
};

export const getAllBookings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const safeLimit = clampLimit(limit, 20, 100);
    const query = {};
    if (status) query.status = status;

    const skip = (Number(page) - 1) * safeLimit;
    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate("user", "name email")
        .populate("driver", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit),
      Booking.countDocuments(query),
    ]);

    res.json({ bookings, pagination: { page: Number(page), pages: Math.ceil(total / safeLimit), total } });
  } catch (error) {
    next(error);
  }
};

export const getDriverDetail = async (req, res, next) => {
  try {
    const driver = await Driver.findById(req.params.id).select("-password");
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }
    const reviewCount = await Booking.countDocuments({ driver: driver._id, status: "completed" });
    res.json({ driver, reviewCount });
  } catch (error) {
    next(error);
  }
};

export const toggleDriverActive = async (req, res, next) => {
  try {
    const driver = await Driver.findById(req.params.id).select("-password");
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    driver.isActive = !driver.isActive;
    if (!driver.isActive) {
      driver.availability = "offline";
    } else if (driver.kycStatus === "approved") {
      driver.availability = "available";
    }
    await driver.save();

    createNotification({
      userId: driver._id,
      userModel: "Driver",
      title: driver.isActive ? "Account Activated" : "Account Deactivated",
      message: driver.isActive
        ? "Your account is now active."
        : "Your account has been deactivated by an admin.",
      type: "system",
      link: "/driver/profile",
    }).catch(() => {});

    res.json({ driver });
  } catch (error) {
    next(error);
  }
};

export const getDashboardStats = async (req, res, next) => {
  try {
    const [totalDrivers, activeDrivers, totalUsers, totalBookings, pendingKyc, statusCounts, revenueAgg] = await Promise.all([
      Driver.countDocuments(),
      Driver.countDocuments({ isActive: true }),
      User.countDocuments(),
      Booking.countDocuments(),
      Driver.countDocuments({ kycStatus: "pending" }),
      Booking.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Payment.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const statusMap = {};
    statusCounts.forEach((s) => (statusMap[s._id] = s.count));

    res.json({
      totalDrivers,
      activeDrivers,
      totalUsers,
      totalBookings,
      pendingKyc,
      completedBookings: statusMap["completed"] || 0,
      cancelledBookings: (statusMap["cancelled"] || 0) + (statusMap["rejected"] || 0),
      revenue: revenueAgg[0]?.total || 0,
    });
  } catch (error) {
    next(error);
  }
};