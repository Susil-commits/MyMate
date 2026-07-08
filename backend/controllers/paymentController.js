import crypto from "crypto";
import Razorpay from "razorpay";
import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";
import Driver from "../models/Driver.js";
import User from "../models/User.js";
import { createNotification } from "../models/Notification.js";
import { sendBookingStatusUpdate } from "../config/email.js";

let razorpayInstance = null;
function getRazorpay() {
  if (razorpayInstance) return razorpayInstance;
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayInstance;
}

const notConfigured = (res) =>
  res.status(400).json({ message: "Online payments are not configured on this server" });

export const createOrder = async (req, res) => {
  const rzp = getRazorpay();
  if (!rzp) return notConfigured(res);

  const { bookingId } = req.body;
  const booking = await Booking.findById(bookingId);
  if (!booking) return res.status(404).json({ message: "Booking not found" });
  if (String(booking.user) !== String(req.user._id)) {
    return res.status(403).json({ message: "Not authorized" });
  }
  if (booking.paymentStatus === "paid") {
    return res.status(400).json({ message: "This booking is already paid" });
  }
  if (["cancelled", "rejected"].includes(booking.status)) {
    return res.status(400).json({ message: "Cannot pay for a cancelled booking" });
  }
  if (booking.status !== "accepted" && booking.status !== "ongoing" && booking.status !== "completed") {
    return res.status(400).json({ message: "Booking must be accepted before payment" });
  }
  if (!booking.totalAmount || booking.totalAmount <= 0) {
    return res.status(400).json({ message: "Invalid booking amount. Contact support." });
  }

  const amount = Math.round(booking.totalAmount * 100);
  let order;
  try {
    order = await rzp.orders.create({
      amount,
      currency: "INR",
      receipt: `booking_${booking._id}`,
    });
  } catch (err) {
    return res.status(502).json({ message: "Could not create payment order", error: err.message });
  }

  await Payment.findOneAndUpdate(
    { booking: booking._id, status: "pending" },
    {
      booking: booking._id,
      user: booking.user,
      driver: booking.driver,
      amount: booking.totalAmount,
      currency: "inr",
      razorpayOrderId: order.id,
      status: "pending",
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  res.json({
    keyId: process.env.RAZORPAY_KEY_ID,
    orderId: order.id,
    amount,
    currency: "INR",
  });
};

export const verifyPayment = async (req, res) => {
  const rzp = getRazorpay();
  if (!rzp) return notConfigured(res);

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
  if (!payment) return res.status(404).json({ message: "Order not found" });
  if (String(payment.user) !== String(req.user._id)) {
    return res.status(403).json({ message: "Not authorized" });
  }
  if (payment.status === "completed") {
    return res.json({ message: "Payment already verified" });
  }

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expected !== razorpay_signature) {
    await Payment.updateOne(
      { _id: payment._id, status: "pending" },
      { $set: { status: "failed" } }
    );
    return res.status(400).json({ message: "Payment signature verification failed" });
  }

  // Atomic update: only transitions pending -> completed. Prevents race condition
  // where two concurrent verify requests both pass the status check above.
  const updated = await Payment.findOneAndUpdate(
    { _id: payment._id, status: "pending" },
    {
      $set: {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: "completed",
        paidAt: new Date(),
      },
    },
    { new: true }
  );

  if (!updated) {
    // Another request already completed this payment
    return res.json({ message: "Payment already verified" });
  }

  const booking = await Booking.findById(payment.booking);
  if (booking) {
    booking.paymentStatus = "paid";
    await booking.save();
    createNotification({
      userId: booking.driver, userModel: "Driver",
      title: "Payment Received",
      message: `Payment of ₹${booking.totalAmount} received for a booking.`,
      type: "payment", link: `/bookings/${booking._id}`,
    }).catch(() => {});
    const [driver, user] = await Promise.all([
      Driver.findById(booking.driver).select("name email"),
      User.findById(booking.user).select("name email"),
    ]);
    if (driver && user) sendBookingStatusUpdate(user, driver, booking, "paid").catch(() => {});
  }

  res.json({ message: "Payment verified successfully" });
};

export const getPaymentStatus = async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId);
  if (!booking) return res.status(404).json({ message: "Booking not found" });
  const isOwner =
    req.userRole === "admin" ||
    (req.userRole === "user" && String(booking.user) === String(req.user._id)) ||
    (req.userRole === "driver" && String(booking.driver) === String(req.user._id));
  if (!isOwner) return res.status(403).json({ message: "Not authorized" });

  const payment = await Payment.findOne({
    booking: booking._id,
    status: { $in: ["pending", "completed", "refunded"] },
  });
  res.json({ paymentStatus: booking.paymentStatus, payment });
};

export const refundPayment = async (req, res) => {
  const rzp = getRazorpay();
  if (!rzp) return notConfigured(res);

  const { bookingId } = req.body;
  const booking = await Booking.findById(bookingId);
  if (!booking) return res.status(404).json({ message: "Booking not found" });
  if (booking.paymentStatus !== "paid") {
    return res.status(400).json({ message: "This booking has not been paid" });
  }

  const payment = await Payment.findOne({ booking: booking._id, status: "completed" });
  if (!payment || !payment.razorpayPaymentId) {
    return res.status(400).json({ message: "No completed payment found to refund" });
  }

  try {
    await rzp.payments.refund(payment.razorpayPaymentId, {
      amount: Math.round(payment.amount * 100),
    });
  } catch (err) {
    return res.status(502).json({ message: "Refund failed", error: err.message });
  }

  payment.status = "refunded";
  await payment.save();
  booking.paymentStatus = "refunded";
  await booking.save();

  res.json({ message: "Refund processed successfully" });
};
