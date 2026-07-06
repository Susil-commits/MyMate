import Review from "../models/Review.js";
import Booking from "../models/Booking.js";
import { createNotification } from "../models/Notification.js";
import { clampLimit } from "../utils/sanitize.js";
import { validationResult } from "express-validator";

export const createReview = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { bookingId, driverId, rating, comment } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only review your own bookings" });
    }

    if (booking.status !== "completed") {
      return res.status(400).json({ message: "Can only review completed bookings" });
    }

    if (booking.totalAmount > 0 && booking.paymentStatus !== "paid") {
      return res.status(400).json({ message: "Payment must be completed before reviewing" });
    }

    if (booking.driver.toString() !== driverId) {
      return res.status(400).json({ message: "Driver ID does not match booking" });
    }

    const existingReview = await Review.findOne({
      user: req.user._id,
      booking: bookingId,
    });
    if (existingReview) {
      return res
        .status(400)
        .json({ message: "You have already reviewed this booking" });
    }

    const review = await Review.create({
      user: req.user._id,
      driver: driverId,
      booking: bookingId,
      rating,
      comment: comment || "",
    });

    await review.populate({ path: "user", select: "name" });

    createNotification({
      userId: driverId,
      userModel: "Driver",
      title: "New Review",
      message: `${review.user?.name || "A customer"} rated you ${rating} star${rating > 1 ? "s" : ""}.`,
      type: "review",
      link: `/driver/dashboard`,
    }).catch(() => {});

    res.status(201).json({ review });
  } catch (error) {
    next(error);
  }
};

export const getDriverReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const safeLimit = clampLimit(limit, 10, 50);
    const skip = (Number(page) - 1) * safeLimit;

    const [reviews, total] = await Promise.all([
      Review.find({ driver: req.params.driverId })
        .populate({ path: "user", select: "name" })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit),
      Review.countDocuments({ driver: req.params.driverId }),
    ]);

    res.json({
      reviews,
      pagination: { page: Number(page), pages: Math.ceil(total / safeLimit), total },
    });
  } catch (error) {
    next(error);
  }
};

export const getBookingReview = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    const isOwner =
      req.userRole === "admin" ||
      booking.user.toString() === req.user._id?.toString() ||
      booking.driver.toString() === req.user._id?.toString();
    if (!isOwner) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const review = await Review.findOne({ booking: req.params.bookingId }).populate({ path: "user", select: "name" });
    res.json({ review: review || null });
  } catch (error) {
    next(error);
  }
};

export const updateReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const { rating, comment } = req.body;
    if (rating) review.rating = rating;
    if (comment !== undefined) review.comment = comment;

    await review.save();
    await review.populate({ path: "user", select: "name" });

    res.json({ review });
  } catch (error) {
    next(error);
  }
};

export const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await Review.findByIdAndDelete(req.params.id);

    res.json({ message: "Review deleted" });
  } catch (error) {
    next(error);
  }
};