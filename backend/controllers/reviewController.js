import Review from "../models/Review.js";
import Booking from "../models/Booking.js";

export const createReview = async (req, res, next) => {
  try {
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

    res.status(201).json({ review });
  } catch (error) {
    next(error);
  }
};

export const getDriverReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [reviews, total] = await Promise.all([
      Review.find({ driver: req.params.driverId })
        .populate({ path: "user", select: "name" })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Review.countDocuments({ driver: req.params.driverId }),
    ]);

    res.json({
      reviews,
      pagination: { page: Number(page), pages: Math.ceil(total / Number(limit)), total },
    });
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