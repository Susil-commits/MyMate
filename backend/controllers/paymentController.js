import crypto from "crypto";
import Razorpay from "razorpay";
import Payment from "../models/Payment.js";
import Booking from "../models/Booking.js";

let razorpayClient;
const getRazorpay = () => {
  if (!razorpayClient) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay is not configured");
    }
    razorpayClient = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayClient;
};

const isConfigured = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

export const createOrder = async (req, res, next) => {
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

    if (!isConfigured()) {
      return res.status(503).json({ message: "Payments are not configured on the server" });
    }

    const existingPayment = await Payment.findOne({
      booking: bookingId,
      status: { $in: ["pending", "completed"] },
    });
    if (existingPayment) {
      if (existingPayment.status === "completed") {
        await Booking.findByIdAndUpdate(bookingId, { paymentStatus: "paid" });
        return res.status(400).json({ message: "Payment already completed" });
      }
      return res.json({
        orderId: existingPayment.razorpayOrderId,
        amount: booking.totalAmount,
        currency: "INR",
      });
    }

    const amountInPaise = Math.round(booking.totalAmount * 100);

    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `booking_${booking._id}`,
      notes: {
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
      currency: "inr",
      razorpayOrderId: order.id,
      status: "pending",
    });

    res.json({
      orderId: order.id,
      amount: booking.totalAmount,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment verification details" });
    }

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!payment) {
      return res.status(404).json({ message: "Payment record not found" });
    }

    if (payment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (payment.status === "completed") {
      return res.json({ payment, verified: true });
    }

    const linkedBooking = await Booking.findById(payment.booking);
    if (linkedBooking && !["accepted", "ongoing", "completed"].includes(linkedBooking.status)) {
      return res.status(400).json({ message: "Booking is no longer active" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      payment.status = "failed";
      await payment.save();
      return res.status(400).json({ message: "Payment signature verification failed" });
    }

    payment.status = "completed";
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.paidAt = new Date();
    await payment.save();

    await Booking.findByIdAndUpdate(payment.booking, { paymentStatus: "paid" });

    res.json({ payment, verified: true });
  } catch (error) {
    next(error);
  }
};

export const getPaymentStatus = async (req, res, next) => {
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

    const payment = await Payment.findOne({ booking: req.params.bookingId }).sort({
      status: 1,
      createdAt: -1,
    });
    if (!payment) {
      return res.json({ hasPayment: false });
    }

    res.json({
      hasPayment: true,
      status: payment.status,
      amount: payment.amount,
      paidAt: payment.paidAt,
      paymentMethod: "razorpay",
      razorpayPaymentId: payment.razorpayPaymentId,
    });
  } catch (error) {
    next(error);
  }
};

export const refundPayment = async (req, res, next) => {
  try {
    const { bookingId } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const payment = await Payment.findOne({ booking: bookingId, status: "completed" });
    if (!payment) {
      return res.status(400).json({ message: "No completed payment found for this booking" });
    }

    if (!isConfigured()) {
      return res.status(503).json({ message: "Payments are not configured on the server" });
    }

    const razorpay = getRazorpay();
    const refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
      amount: Math.round(payment.amount * 100),
    });

    payment.status = "refunded";
    await payment.save();

    booking.paymentStatus = "refunded";
    await booking.save();

    res.json({ payment, refundId: refund.id });
  } catch (error) {
    next(error);
  }
};
