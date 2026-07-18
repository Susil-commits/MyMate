// @ts-nocheck
import Review from "../models/Review.js";
import Booking from "../models/Booking.js";
import { createNotification } from "../models/Notification.js";

export const createReview = async (req, res) => {
  const { bookingId, driverId, rating, comment } = req.body;

  const booking = await Booking.findById(bookingId);
  if (!booking) return res.status(404).json({ message: "Booking not found" });
  if (String(booking.user) !== String(req.user._id)) {
    return res.status(403).json({ message: "Not authorized" });
  }
  if (booking.status !== "completed") {
    return res.status(400).json({ message: "You can only review completed bookings" });
  }
  if (booking.paymentStatus !== "paid") {
    return res.status(400).json({ message: "Please complete the payment before reviewing" });
  }
  if (String(booking.driver) !== String(driverId)) {
    return res.status(400).json({ message: "Driver does not match this booking" });
  }

  const existing = await Review.findOne({ booking: bookingId });
  if (existing) {
    return res.status(400).json({ message: "You have already reviewed this booking" });
  }

  const review = await Review.create({
    user: req.user._id,
    driver: driverId,
    booking: bookingId,
    rating,
    comment: comment || "",
  });

  createNotification({
    userId: driverId, userModel: "Driver",
    title: "New Review",
    message: `You received a ${rating}-star review.`,
    type: "review", link: "/driver/bookings",
  }).catch(() => {});

  res.status(201).json({ review });
};

export const getDriverReviews = async (req, res) => {
  const reviews = await Review.find({ driver: req.params.driverId })
    .populate("user", "name avatar")
    .sort({ createdAt: -1 });
  res.json({ reviews });
};

export const getBookingReview = async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId);
  if (!booking) return res.status(404).json({ message: "Booking not found" });
  const isOwner =
    (req.userRole === "user" && String(booking.user) === String(req.user._id)) ||
    (req.userRole === "driver" && String(booking.driver) === String(req.user._id)) ||
    req.userRole === "admin";
  if (!isOwner) return res.status(403).json({ message: "Not authorized" });

  const review = await Review.findOne({ booking: req.params.bookingId }).populate("user", "name");
  if (!review) return res.status(404).json({ message: "No review yet" });
  res.json({ review });
};

export const updateReview = async (req, res) => {
  const { rating, comment } = req.body;
  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ message: "Review not found" });
  if (String(review.user) !== String(req.user._id)) {
    return res.status(403).json({ message: "Not authorized" });
  }
  if (rating !== undefined) review.rating = rating;
  if (comment !== undefined) review.comment = comment;
  await review.save();
  res.json({ review });
};

export const deleteReview = async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ message: "Review not found" });
  if (String(review.user) !== String(req.user._id)) {
    return res.status(403).json({ message: "Not authorized" });
  }
  await Review.findByIdAndDelete(req.params.id);
  res.json({ message: "Review deleted" });
};
