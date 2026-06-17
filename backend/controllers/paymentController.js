import Stripe from "stripe";
import Payment from "../models/Payment.js";
import Booking from "../models/Booking.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createPaymentIntent = async (req, res, next) => {
  try {
    const { bookingId } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (booking.status !== "accepted") {
      return res.status(400).json({ message: "Booking must be accepted before payment" });
    }

    if (booking.paymentStatus === "paid") {
      return res.status(400).json({ message: "Payment already completed" });
    }

    const existingPayment = await Payment.findOne({ booking: bookingId, status: "completed" });
    if (existingPayment) {
      return res.status(400).json({ message: "Payment already exists" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(booking.totalAmount * 100),
      currency: "usd",
      metadata: {
        bookingId: bookingId,
        userId: req.user._id.toString(),
        driverId: booking.driver.toString(),
      },
    });

    await Payment.create({
      booking: bookingId,
      user: req.user._id,
      driver: booking.driver,
      amount: booking.totalAmount,
      paymentIntentId: paymentIntent.id,
      status: "pending",
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: booking.totalAmount,
    });
  } catch (error) {
    next(error);
  }
};

export const confirmPayment = async (req, res, next) => {
  try {
    const { paymentIntentId } = req.body;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({ message: "Payment not completed" });
    }

    const payment = await Payment.findOne({ paymentIntentId });
    if (!payment) {
      return res.status(404).json({ message: "Payment record not found" });
    }

    payment.status = "completed";
    payment.paidAt = new Date();
    await payment.save();

    await Booking.findByIdAndUpdate(payment.booking, { paymentStatus: "paid" });

    res.json({ payment });
  } catch (error) {
    next(error);
  }
};

export const getPaymentStatus = async (req, res, next) => {
  try {
    const payment = await Payment.findOne({ booking: req.params.bookingId });
    if (!payment) {
      return res.json({ hasPayment: false });
    }

    res.json({
      hasPayment: true,
      status: payment.status,
      amount: payment.amount,
      paidAt: payment.paidAt,
    });
  } catch (error) {
    next(error);
  }
};