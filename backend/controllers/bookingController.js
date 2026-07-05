import Booking from "../models/Booking.js";
import Driver from "../models/Driver.js";
import { createNotification } from "../models/Notification.js";
import { sendBookingConfirmation, sendBookingStatusUpdate } from "../config/email.js";
import { sanitizeDriver, clampLimit } from "../utils/sanitize.js";

const ACTIVE_STATUSES = ["accepted", "ongoing", "completed"];

const sanitizeBooking = (booking) => {
  const obj = booking.toObject ? booking.toObject() : { ...booking };
  if (obj.driver) {
    obj.driver = sanitizeDriver(obj.driver, {
      withContact: ACTIVE_STATUSES.includes(obj.status),
    });
  }
  return obj;
};

export const createBooking = async (req, res, next) => {
  try {
    const { driverId, hireType, startDate, endDate, pickupLocation, dropLocation, purpose } =
      req.body;

    const driver = await Driver.findById(driverId);
    if (!driver || !driver.isActive) {
      return res.status(404).json({ message: "Driver not found or inactive" });
    }

    if (driver.availability !== "available") {
      return res.status(400).json({ message: "Driver is not available" });
    }

    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;

    let totalAmount = 0;
    if (hireType === "temporary") {
      const hours = end ? Math.ceil((end - start) / (1000 * 60 * 60)) : 1;
      totalAmount = hours * driver.hourlyRate;
    } else {
      const days = end ? Math.ceil((end - start) / (1000 * 60 * 60 * 24)) : 30;
      totalAmount = days * driver.dailyRate;
    }

    const booking = await Booking.create({
      user: req.user._id,
      driver: driverId,
      hireType,
      startDate,
      endDate: end,
      pickupLocation,
      dropLocation: dropLocation || "",
      purpose,
      totalAmount,
    });

    await booking.populate([
      { path: "user", select: "name email phone" },
      { path: "driver", select: "-password" },
    ]);

    sendBookingConfirmation(booking.user, booking.driver, booking).catch(() => {});
    createNotification({
      userId: driverId,
      userModel: "Driver",
      title: "New Booking Request",
      message: `${booking.user.name} wants to hire you (${hireType})`,
      type: "booking",
      link: `/driver/bookings`,
    }).catch(() => {});

    res.status(201).json({ booking: sanitizeBooking(booking) });
  } catch (error) {
    next(error);
  }
};

export const getUserBookings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const safeLimit = clampLimit(limit, 10, 50);
    const query = { user: req.user._id };
    if (status) query.status = status;

    const skip = (Number(page) - 1) * safeLimit;

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate({ path: "driver", select: "-password" })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit),
      Booking.countDocuments(query),
    ]);

    res.json({
      bookings: bookings.map(sanitizeBooking),
      pagination: { page: Number(page), pages: Math.ceil(total / safeLimit), total },
    });
  } catch (error) {
    next(error);
  }
};

export const getDriverBookings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const safeLimit = clampLimit(limit, 10, 50);
    const query = { driver: req.user._id };
    if (status) query.status = status;

    const skip = (Number(page) - 1) * safeLimit;

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate({ path: "user", select: "name email phone" })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit),
      Booking.countDocuments(query),
    ]);

    res.json({
      bookings: bookings.map(sanitizeBooking),
      pagination: { page: Number(page), pages: Math.ceil(total / safeLimit), total },
    });
  } catch (error) {
    next(error);
  }
};

export const updateBookingStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ["accepted", "rejected", "ongoing", "completed", "cancelled"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (req.userRole === "driver") {
      if (booking.driver.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const driverTransitions = {
        accepted: ["pending"],
        rejected: ["pending"],
        ongoing: ["accepted"],
        completed: ["ongoing"],
        cancelled: ["pending", "accepted"],
      };
      if (!driverTransitions[status]?.includes(booking.status)) {
        return res.status(400).json({
          message: `Cannot transition from ${booking.status} to ${status}`,
        });
      }

      if (status === "accepted" || status === "ongoing") {
        await Driver.findByIdAndUpdate(booking.driver, { availability: "busy" });
      }
      if (status === "completed" || status === "cancelled" || status === "rejected") {
        await Driver.findByIdAndUpdate(booking.driver, { availability: "available" });
      }
    }

    if (req.userRole === "user" && status !== "cancelled") {
      return res.status(403).json({ message: "Users can only cancel bookings" });
    }

    if (req.userRole === "user" && status === "cancelled") {
      if (!["pending", "accepted"].includes(booking.status)) {
        return res.status(400).json({ message: "Cannot cancel this booking" });
      }
    }

    booking.status = status;
    booking.cancellationReason = ["cancelled", "rejected"].includes(status) ? (req.body.reason || "") : "";
    await booking.save();

    await booking.populate([
      { path: "user", select: "name email phone" },
      { path: "driver", select: "-password" },
    ]);

    const statusMessages = {
      accepted: { title: "Booking Accepted", message: `${booking.driver.name || "Driver"} accepted your booking request.` },
      rejected: { title: "Booking Rejected", message: `${booking.driver.name || "Driver"} declined your booking request.` },
      ongoing: { title: "Trip Started", message: `${booking.driver.name || "Driver"} has started your trip.` },
      completed: { title: "Trip Completed", message: "Your trip is complete. Please leave a review." },
    };

    if (req.userRole === "driver" && statusMessages[status]) {
      createNotification({
        userId: booking.user._id,
        userModel: "User",
        title: statusMessages[status].title,
        message: statusMessages[status].message,
        type: "booking",
        link: `/bookings/${booking._id}`,
      }).catch(() => {});
    }

    if (req.userRole === "user" && status === "cancelled") {
      createNotification({
        userId: booking.driver._id,
        userModel: "Driver",
        title: "Booking Cancelled",
        message: `${booking.user.name || "Customer"} cancelled a booking.`,
        type: "booking",
        link: `/driver/bookings`,
      }).catch(() => {});
    }

    sendBookingStatusUpdate(booking.user, booking.driver, booking, status).catch(() => {});

    res.json({ booking: sanitizeBooking(booking) });
  } catch (error) {
    next(error);
  }
};

export const getBookingById = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id).populate([
      { path: "user", select: "name email phone" },
      { path: "driver", select: "-password" },
    ]);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (
      booking.user._id.toString() !== req.user._id.toString() &&
      booking.driver._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    res.json({ booking: sanitizeBooking(booking) });
  } catch (error) {
    next(error);
  }
};

export const getDriverStats = async (req, res, next) => {
  try {
    const driverId = req.user._id;

    const [counts, earningsAgg] = await Promise.all([
      Booking.aggregate([
        { $match: { driver: driverId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Booking.aggregate([
        {
          $match: {
            driver: driverId,
            status: "completed",
            paymentStatus: "paid",
          },
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
    ]);

    const statusMap = {};
    counts.forEach((c) => (statusMap[c._id] = c.count));

    res.json({
      totalBookings: Object.values(statusMap).reduce((a, b) => a + b, 0),
      pendingBookings: statusMap["pending"] || 0,
      activeBookings: (statusMap["accepted"] || 0) + (statusMap["ongoing"] || 0),
      completedBookings: statusMap["completed"] || 0,
      cancelledBookings: (statusMap["cancelled"] || 0) + (statusMap["rejected"] || 0),
      earnings: earningsAgg[0]?.total || 0,
    });
  } catch (error) {
    next(error);
  }
};