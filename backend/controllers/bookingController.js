import Booking from "../models/Booking.js";
import Driver from "../models/Driver.js";
import User from "../models/User.js";
import { clampLimit } from "../utils/sanitize.js";
import { buildPagination } from "../utils/pagination.js";
import { createNotification } from "../models/Notification.js";
import { sendBookingConfirmation, sendBookingStatusUpdate } from "../config/email.js";

const HOUR = 1000 * 60 * 60;
const DAY = HOUR * 24;

function computeAmount(hireType, start, end, driver) {
  if (hireType === "temporary") {
    const hours = end ? Math.max(1, Math.ceil((end - start) / HOUR)) : 1;
    return hours * (driver.hourlyRate || 0);
  }
  const days = end ? Math.max(1, Math.ceil((end - start) / DAY)) : 30;
  return days * (driver.dailyRate || 0);
}

async function notifyBookingUpdate(booking, status, actorRole) {
  const [user, driver] = await Promise.all([
    User.findById(booking.user).select("name email"),
    Driver.findById(booking.driver).select("name email"),
  ]);
  if (!user || !driver) return;
  if (actorRole !== "user") {
    createNotification({
      userId: user._id, userModel: "User",
      title: "Booking Update",
      message: `Your booking is now ${status}.`,
      type: "booking", link: `/bookings/${booking._id}`,
    }).catch(() => {});
  }
  if (actorRole !== "driver") {
    createNotification({
      userId: driver._id, userModel: "Driver",
      title: "Booking Update",
      message: `Booking request has been ${status}.`,
      type: "booking", link: `/bookings/${booking._id}`,
    }).catch(() => {});
  }
  sendBookingStatusUpdate(user, driver, booking, status).catch(() => {});
}

export const createBooking = async (req, res) => {
  const { driverId, hireType, startDate, endDate, pickupLocation, dropLocation, purpose } = req.body;
  const driver = await Driver.findById(driverId);
  if (!driver || driver.kycStatus !== "approved" || !driver.isActive) {
    return res.status(404).json({ message: "This driver is not available for booking" });
  }

  // Prevent duplicate active bookings between the same user and driver
  const existing = await Booking.findOne({
    user: req.user._id,
    driver: driverId,
    status: { $in: ["pending", "accepted", "ongoing"] },
  });
  if (existing) {
    return res.status(409).json({
      message: "You already have an active booking with this driver",
      bookingId: existing._id,
    });
  }

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;
  const totalAmount = computeAmount(hireType, start, end, driver);

  const booking = await Booking.create({
    user: req.user._id,
    driver: driverId,
    hireType,
    startDate: start,
    endDate: end,
    pickupLocation,
    dropLocation: dropLocation || "",
    purpose,
    totalAmount,
    status: "pending",
    paymentStatus: "pending",
  });

  createNotification({
    userId: driver._id, userModel: "Driver",
    title: "New Booking Request",
    message: `New ${hireType} booking request from ${req.user.name || "a customer"}.`,
    type: "booking", link: `/bookings/${booking._id}`,
  }).catch(() => {});

  sendBookingConfirmation(req.user, driver, booking).catch(() => {});

  res.status(201).json({ booking });
};

export const getUserBookings = async (req, res) => {
  const { status, page, limit } = req.query;
  const filter = { user: req.user._id };
  if (status) filter.status = status;
  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = clampLimit(limit, 10, 50);
  const skip = (pageNum - 1) * limitNum;
  const [total, bookings] = await Promise.all([
    Booking.countDocuments(filter),
    Booking.find(filter)
      .populate("driver", "name locality avatar averageRating")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
  ]);
  res.json({ bookings, pagination: buildPagination(total, pageNum, limitNum) });
};

export const getDriverBookings = async (req, res) => {
  const { status, page, limit } = req.query;
  const filter = { driver: req.user._id };
  if (status) filter.status = status;
  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = clampLimit(limit, 10, 50);
  const skip = (pageNum - 1) * limitNum;
  const [total, bookings] = await Promise.all([
    Booking.countDocuments(filter),
    Booking.find(filter)
      .populate("user", "name phone avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
  ]);
  res.json({ bookings, pagination: buildPagination(total, pageNum, limitNum) });
};

export const getDriverStats = async (req, res) => {
  const stats = await Booking.aggregate([
    { $match: { driver: req.user._id } },
    {
      $group: {
        _id: null,
        totalBookings: { $sum: 1 },
        completedBookings: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        pendingBookings: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
        earnings: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$status", "completed"] }, { $eq: ["$paymentStatus", "paid"] }] },
              "$totalAmount",
              0,
            ],
          },
        },
      },
    },
  ]);
  const s = stats[0] || { totalBookings: 0, completedBookings: 0, pendingBookings: 0, earnings: 0 };
  res.json({
    totalBookings: s.totalBookings,
    completedBookings: s.completedBookings,
    pendingBookings: s.pendingBookings,
    earnings: s.earnings,
  });
};

export const getBookingById = async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate("driver", "name phone locality avatar")
    .populate("user", "name phone avatar");
  if (!booking) return res.status(404).json({ message: "Booking not found" });

  const isOwner =
    req.userRole === "admin" ||
    (req.userRole === "user" && String(booking.user?._id) === String(req.user._id)) ||
    (req.userRole === "driver" && String(booking.driver?._id) === String(req.user._id));
  if (!isOwner) return res.status(403).json({ message: "Not authorized to view this booking" });

  res.json({ booking });
};

const TRANSITIONS = {
  user: {
    pending: ["cancelled"],
    accepted: ["cancelled"],
  },
  driver: {
    pending: ["accepted", "rejected", "cancelled"],
    accepted: ["ongoing", "cancelled"],
    ongoing: ["completed", "cancelled"],
  },
  admin: {
    pending: ["accepted", "rejected", "cancelled"],
    accepted: ["ongoing", "cancelled"],
    ongoing: ["completed", "cancelled"],
    completed: ["cancelled"],
  },
};

export const updateBookingStatus = async (req, res) => {
  const { status } = req.body;
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: "Booking not found" });

  const role = req.userRole;
  const isOwner =
    role === "admin" ||
    (role === "user" && String(booking.user) === String(req.user._id)) ||
    (role === "driver" && String(booking.driver) === String(req.user._id));
  if (!isOwner) return res.status(403).json({ message: "Not authorized" });

  const allowed = TRANSITIONS[role]?.[booking.status] || [];
  if (!allowed.includes(status)) {
    return res.status(400).json({
      message: `Cannot change a ${booking.status} booking to ${status}`,
    });
  }

  booking.status = status;
  if (req.body.cancellationReason) booking.cancellationReason = req.body.cancellationReason;
  await booking.save();

  notifyBookingUpdate(booking, status, role).catch(() => {});

  const populated = await Booking.findById(booking._id)
    .populate("driver", "name phone locality avatar averageRating")
    .populate("user", "name phone avatar");
  res.json({ booking: populated });
};
