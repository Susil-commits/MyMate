import Driver from "../models/Driver.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import { createNotification } from "../models/Notification.js";
import { sendKycStatusEmail } from "../config/email.js";

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
        documentsVerified: status === "approved",
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
    const query = {};
    if (kycStatus) query.kycStatus = kycStatus;

    const skip = (Number(page) - 1) * Number(limit);
    const [drivers, total] = await Promise.all([
      Driver.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).select("-password"),
      Driver.countDocuments(query),
    ]);

    res.json({ drivers, pagination: { page: Number(page), pages: Math.ceil(total / Number(limit)), total } });
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find().sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).select("-password"),
      User.countDocuments(),
    ]);

    res.json({ users, pagination: { page: Number(page), pages: Math.ceil(total / Number(limit)), total } });
  } catch (error) {
    next(error);
  }
};

export const getAllBookings = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [bookings, total] = await Promise.all([
      Booking.find()
        .populate("user", "name email")
        .populate("driver", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Booking.countDocuments(),
    ]);

    res.json({ bookings, pagination: { page: Number(page), pages: Math.ceil(total / Number(limit)), total } });
  } catch (error) {
    next(error);
  }
};

export const getDashboardStats = async (req, res, next) => {
  try {
    const [totalDrivers, totalUsers, totalBookings, pendingKyc] = await Promise.all([
      Driver.countDocuments(),
      User.countDocuments(),
      Booking.countDocuments(),
      Driver.countDocuments({ kycStatus: "pending" }),
    ]);

    res.json({ totalDrivers, totalUsers, totalBookings, pendingKyc });
  } catch (error) {
    next(error);
  }
};