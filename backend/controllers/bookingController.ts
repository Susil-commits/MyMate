import Booking from "../models/Booking.js";
import Driver from "../models/Driver.js";
import User from "../models/User.js";
import PromoCode from "../models/PromoCode.js";
import { clampLimit } from "../utils/sanitize.js";
import { buildPagination } from "../utils/pagination.js";
import { createNotification } from "../models/Notification.js";
import { sendBookingConfirmation, sendBookingStatusUpdate } from "../config/email.js";
import { getIo } from "../utils/socket.js";
import { eventBus } from "../events/bookingEvents.js";
import { calculateDynamicSurge } from "../utils/pricingEngine.js";
import * as ics from "ics";
import PDFDocument from "pdfkit";

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
  const { 
    driverId, hireType, startDate, endDate, pickupLocation, dropLocation, 
    purpose, promoCode, stops, isRecurring, recurringPattern, recurringEndDate 
  } = req.body;
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
  
  // 1. Compute Base Amount
  let baseAmount = computeAmount(hireType, start, end, driver);
  // 2. Compute Dynamic Surge Pricing
  let surgeMultiplier = await calculateDynamicSurge(start);

  let totalAmount = baseAmount * surgeMultiplier;
  let discountAmount = 0;
  let appliedPromo = null;

  if (promoCode) {
    const promo = await PromoCode.findOne({
      code: promoCode.toUpperCase(),
      isActive: true,
      expiryDate: { $gt: new Date() },
    });
    
    if (promo && (!promo.usageLimit || promo.usedCount < promo.usageLimit)) {
      const calculatedDiscount = (totalAmount * promo.discountPercentage) / 100;
      discountAmount = Math.min(calculatedDiscount, promo.maxDiscount);
      totalAmount = totalAmount - discountAmount;
      appliedPromo = promo.code;
      
      // Increment usedCount
      promo.usedCount += 1;
      await promo.save();
    }
  }

  const baseBookingData = {
    user: req.user._id,
    driver: driverId,
    hireType,
    pickupLocation,
    dropLocation: dropLocation || "",
    stops: Array.isArray(stops) ? stops : [],
    purpose,
    baseAmount,
    surgeMultiplier,
    totalAmount,
    promoCode: appliedPromo,
    discountAmount,
    status: "pending",
    paymentStatus: "pending",
  };

  let createdBookings = [];

  if (isRecurring && recurringPattern !== "none" && recurringEndDate) {
    const rEnd = new Date(recurringEndDate);
    const groupId = `REC-${Date.now()}`;
    const bookingsToCreate = [];
    
    let currentStart = new Date(start);
    let currentEnd = end ? new Date(end) : null;
    const duration = end ? end.getTime() - start.getTime() : 0;

    while (currentStart <= rEnd) {
      bookingsToCreate.push({
        ...baseBookingData,
        startDate: new Date(currentStart),
        endDate: currentEnd ? new Date(currentEnd) : null,
        isRecurring: true,
        recurringPattern,
        recurringEndDate: rEnd,
        recurringGroupId: groupId
      });

      // Advance by pattern
      if (recurringPattern === "daily") {
        currentStart.setDate(currentStart.getDate() + 1);
        if (currentEnd) currentEnd.setDate(currentEnd.getDate() + 1);
      } else if (recurringPattern === "weekly") {
        currentStart.setDate(currentStart.getDate() + 7);
        if (currentEnd) currentEnd.setDate(currentEnd.getDate() + 7);
      } else {
        break;
      }
    }

    if (bookingsToCreate.length === 0) {
      return res.status(400).json({ message: "Invalid recurring configuration" });
    }
    
    // Insert all
    createdBookings = await Booking.insertMany(bookingsToCreate);
  } else {
    // Single booking
    const singleBooking = await Booking.create({
      ...baseBookingData,
      startDate: start,
      endDate: end,
    });
    createdBookings = [singleBooking];
  }

  const primaryBooking = createdBookings[0];

  eventBus.emit("BOOKING_CREATED", {
    primaryBooking,
    driverId: driver._id,
    user: req.user,
    isRecurring,
    hireType
  });

  res.status(201).json({ booking: primaryBooking, totalCreated: createdBookings.length });
};

export const getUserBookings = async (req, res) => {
  const { status, page, limit } = req.query;
  const filter: any = { user: req.user._id };
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
  const filter: any = { driver: req.user._id };
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

  if (status === "cancelled" && booking.paymentStatus === "paid") {
    try {
      const Payment = (await import("../models/Payment.js")).default;
      const Razorpay = (await import("razorpay")).default;
      const WalletTransaction = (await import("../models/WalletTransaction.js")).default;
      const Driver = (await import("../models/Driver.js")).default;

      const payment = await Payment.findOne({ booking: booking._id, status: "completed" });
      if (payment && payment.razorpayPaymentId) {
        if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
          const rzp = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
          });
          await rzp.payments.refund(payment.razorpayPaymentId, {
            amount: Math.round(payment.amount * 100),
          });
          payment.status = "refunded";
          await payment.save();
          booking.paymentStatus = "refunded";

          // Deduct from driver wallet since booking was cancelled
          const driverAmount = booking.totalAmount * 0.9;
          await Driver.findByIdAndUpdate(booking.driver, { $inc: { walletBalance: -driverAmount } });
          await WalletTransaction.create({
            driver: booking.driver,
            type: "debit",
            amount: driverAmount,
            description: `Refund deduction for cancelled booking ${booking._id}`,
            booking: booking._id,
          });
        }
      }
    } catch (err) {
      console.error("Auto-refund failed on cancellation:", err);
    }
  }

  booking.status = status;
  if (req.body.cancellationReason) booking.cancellationReason = req.body.cancellationReason;
  await booking.save();

  const populated = await Booking.findById(booking._id)
    .populate("driver", "name phone locality avatar averageRating")
    .populate("user", "name phone avatar");
    
  eventBus.emit("BOOKING_STATUS_CHANGED", {
    booking: populated,
    user: (populated as any).user,
    driver: (populated as any).driver,
    status
  });

  res.json({ booking: populated });
};

export const downloadCalendar = async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate("driver", "name email phone")
    .populate("user", "name email phone");

  if (!booking) return res.status(404).json({ message: "Booking not found" });

  const start = new Date(booking.startDate);
  const end = booking.endDate ? new Date(booking.endDate) : new Date(start.getTime() + 60 * 60 * 1000);

  const event = {
    start: [start.getFullYear(), start.getMonth() + 1, start.getDate(), start.getHours(), start.getMinutes()],
    end: [end.getFullYear(), end.getMonth() + 1, end.getDate(), end.getHours(), end.getMinutes()],
    title: `MyMate Booking with ${(booking.driver as any).name}`,
    description: `Booking ID: ${booking._id}\nPickup: ${booking.pickupLocation}\nDrop: ${booking.dropLocation}\nPurpose: ${booking.purpose}`,
    location: booking.pickupLocation,
    status: 'CONFIRMED',
    busyStatus: 'BUSY',
    organizer: { name: 'MyMate', email: 'noreply@mymate.com' },
    attendees: [
      { name: (booking.user as any).name || "Customer", email: (booking.user as any).email || "user@example.com", rsvp: true, partstat: 'ACCEPTED', role: 'REQ-PARTICIPANT' },
      { name: (booking.driver as any).name || "Driver", email: (booking.driver as any).email || "driver@example.com", rsvp: true, partstat: 'ACCEPTED', role: 'REQ-PARTICIPANT' }
    ]
  };

  ics.createEvent(event as any, (error, value) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ message: "Error generating calendar event" });
    }
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="mymate-booking-${booking._id}.ics"`);
    res.send(value);
  });
};

export const downloadInvoice = async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate("driver", "name phone email")
    .populate("user", "name phone email");

  if (!booking) return res.status(404).json({ message: "Booking not found" });
  if (booking.status !== "completed" || booking.paymentStatus !== "paid") {
    return res.status(400).json({ message: "Invoice is only available for paid and completed bookings." });
  }

  const doc = new PDFDocument({ margin: 50 });
  
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="invoice-${booking._id}.pdf"`);
  
  doc.pipe(res);

  // Header
  doc.fontSize(20).text("MyMate Invoice", { align: "center" });
  doc.moveDown();
  
  // Booking Info
  doc.fontSize(12).text(`Invoice Number: ${booking._id}`);
  doc.text(`Date: ${new Date().toLocaleDateString()}`);
  doc.moveDown();
  
  // Customer & Driver
  doc.text(`Customer: ${(booking.user as any).name} (${(booking.user as any).email})`);
  doc.text(`Driver: ${(booking.driver as any).name} (${(booking.driver as any).email})`);
  doc.moveDown();
  
  // Trip Details
  doc.text(`Pickup: ${booking.pickupLocation}`);
  if (booking.dropLocation) doc.text(`Drop: ${booking.dropLocation}`);
  if (booking.stops && booking.stops.length > 0) doc.text(`Stops: ${booking.stops.join(", ")}`);
  doc.text(`Hire Type: ${booking.hireType}`);
  doc.text(`Start Date: ${new Date(booking.startDate).toLocaleString()}`);
  if (booking.endDate) doc.text(`End Date: ${new Date(booking.endDate).toLocaleString()}`);
  doc.moveDown();

  // Financials
  doc.text(`Base Amount: Rs. ${booking.baseAmount || (booking.totalAmount + booking.discountAmount)}`);
  if (booking.surgeMultiplier > 1) {
    doc.text(`Surge Multiplier: x${booking.surgeMultiplier}`);
  }
  if (booking.discountAmount > 0) {
    doc.text(`Discount (${booking.promoCode}): - Rs. ${booking.discountAmount}`);
  }
  doc.moveDown();
  doc.fontSize(16).text(`Total Paid: Rs. ${booking.totalAmount}`, { underline: true });

  // Footer
  doc.moveDown(4);
  doc.fontSize(10).text("Thank you for using MyMate!", { align: "center" });

  doc.end();
};
