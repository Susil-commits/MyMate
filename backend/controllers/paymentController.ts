import crypto from "crypto";
import Razorpay from "razorpay";
import { Response } from "express";
import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";
import Driver from "../models/Driver.js";
import User from "../models/User.js";
import WalletTransaction from "../models/WalletTransaction.js";
import { createNotification } from "../models/Notification.js";
import { sendBookingStatusUpdate } from "../config/email.js";
import { publishKafkaEvent, KAFKA_TOPICS } from "../kafka/index.js";
import { AuthRequest } from "../middleware/auth.js";
import {
  createPaymentOrderSchema,
  verifyPaymentSchema,
  refundPaymentSchema,
  payWithWalletSchema,
} from "../utils/validators.js";
import { getDriverWalletSplitPercentage } from "../config/platformSettings.js";


let razorpayInstance: Razorpay | null = null;
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

const notConfigured = (res: Response) =>
  res.status(400).json({ message: "Online payments are not configured on this server" });

export const createOrder = async (req: AuthRequest, res: Response) => {
  const rzp = getRazorpay();
  if (!rzp) return notConfigured(res);

  const { bookingId } = createPaymentOrderSchema.parse(req.body);
  const booking = await Booking.findById(bookingId);
  if (!booking) return res.status(404).json({ message: "Booking not found" });
  if (String(booking.user) !== String((req.user as any)?._id)) {
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
  } catch (err: any) {
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

export const verifyPayment = async (req: AuthRequest, res: Response) => {
  const rzp = getRazorpay();
  if (!rzp) return notConfigured(res);

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = verifyPaymentSchema.parse(req.body);
  const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
  if (!payment) return res.status(404).json({ message: "Order not found" });
  if (String(payment.user) !== String((req.user as any)?._id)) {
    return res.status(403).json({ message: "Not authorized" });
  }
  if (payment.status === "completed") {
    return res.json({ message: "Payment already verified" });
  }

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET as string)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const signaturesMatch =
    expected.length === razorpay_signature?.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));

  if (!signaturesMatch) {
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

  await reconcilePayment(updated, "razorpay");

  res.json({ message: "Payment verified successfully" });
};

/**
 * Shared, idempotent payment reconciliation helper.
 * Reconciles booking status, driver wallet credit (90/10 split),
 * notifications, email updates, and Kafka events.
 */
export const reconcilePayment = async (
  paymentOrId: any,
  paymentMethod: "razorpay" | "razorpay_webhook" = "razorpay"
) => {
  const payment =
    paymentOrId && typeof paymentOrId === "object" && paymentOrId.booking
      ? paymentOrId
      : await Payment.findById(paymentOrId);

  if (!payment) return null;

  const booking = await Booking.findById(payment.booking);
  if (booking && booking.paymentStatus !== "paid") {
    // Atomically credit driver wallet (90% to driver, 10% platform fee)
    booking.paymentStatus = "paid";
    await booking.save();

    // Credit Driver Wallet according to platform split percentage
    const splitFraction = getDriverWalletSplitPercentage();
    const platformFeePct = Math.round((1 - splitFraction) * 100);
    const driverAmount = Math.round(booking.totalAmount * splitFraction * 100) / 100;
    await Driver.findByIdAndUpdate(booking.driver, { $inc: { walletBalance: driverAmount } });
    const description =
      paymentMethod === "razorpay_webhook"
        ? `Earnings for booking ${booking._id} (via webhook reconciliation)`
        : `Earnings for booking ${booking._id} (after ${platformFeePct}% platform fee)`;

    await WalletTransaction.create({
      driver: booking.driver,
      type: "credit",
      amount: driverAmount,
      description,
      booking: booking._id,
    });

    createNotification({
      userId: booking.driver,
      userModel: "Driver",
      title: "Payment Received",
      message: `Payment of ₹${booking.totalAmount} received for a booking. ₹${driverAmount.toFixed(2)} added to your wallet.`,
      type: "payment",
      link: `/bookings/${booking._id}`,
    }).catch(() => {});

    const [driver, user] = await Promise.all([
      Driver.findById(booking.driver).select("name email"),
      User.findById(booking.user).select("name email"),
    ]);
    if (driver && user) sendBookingStatusUpdate(user, driver, booking, "paid").catch(() => {});

    publishKafkaEvent(KAFKA_TOPICS.PAYMENT_COMPLETED, String(payment._id), {
      paymentId: payment._id,
      bookingId: booking._id,
      driverId: booking.driver,
      userId: booking.user,
      totalAmount: booking.totalAmount,
      driverAmount,
      paymentMethod,
    }).catch(() => {});
  }

  return payment;
};

export const getPaymentStatus = async (req: AuthRequest, res: Response) => {
  const booking = await Booking.findById(req.params.bookingId);
  if (!booking) return res.status(404).json({ message: "Booking not found" });
  const isOwner =
    req.userRole === "admin" ||
    (req.userRole === "user" && String(booking.user) === String((req.user as any)?._id)) ||
    (req.userRole === "driver" && String(booking.driver) === String((req.user as any)?._id));
  if (!isOwner) return res.status(403).json({ message: "Not authorized" });

  const payment = await Payment.findOne({
    booking: booking._id,
    status: { $in: ["pending", "completed", "refunded"] },
  });
  res.json({ paymentStatus: booking.paymentStatus, payment });
};

export const refundPayment = async (req: AuthRequest, res: Response) => {
  const rzp = getRazorpay();
  if (!rzp) return notConfigured(res);

  const { bookingId } = refundPaymentSchema.parse(req.body);
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
  } catch (err: any) {
    return res.status(502).json({ message: "Refund failed", error: err.message });
  }

  payment.status = "refunded";
  await payment.save();
  booking.paymentStatus = "refunded";
  await booking.save();

  res.json({ message: "Refund processed successfully" });
};

export const payWithWallet = async (req: AuthRequest, res: Response) => {
  const { bookingId } = payWithWalletSchema.parse(req.body);
  const booking = await Booking.findById(bookingId);
  if (!booking) return res.status(404).json({ message: "Booking not found" });
  if (String(booking.user) !== String((req.user as any)?._id)) {
    return res.status(403).json({ message: "Not authorized" });
  }
  if (booking.paymentStatus === "paid") {
    return res.status(400).json({ message: "This booking is already paid" });
  }
  if (["cancelled", "rejected"].includes(booking.status)) {
    return res.status(400).json({ message: "Cannot pay for a cancelled booking" });
  }
  if (!booking.totalAmount || booking.totalAmount <= 0) {
    return res.status(400).json({ message: "Invalid booking amount" });
  }

  // Atomically check and deduct wallet balance
  const updatedUser = await User.findOneAndUpdate(
    {
      _id: (req.user as any)?._id,
      walletBalance: { $gte: booking.totalAmount },
    },
    { $inc: { walletBalance: -booking.totalAmount } },
    { new: true }
  );

  if (!updatedUser) {
    return res.status(400).json({ message: "Insufficient wallet balance" });
  }

  await WalletTransaction.create({
    owner: updatedUser._id,
    ownerModel: "User",
    type: "debit",
    amount: booking.totalAmount,
    description: `Payment for booking ${booking._id}`,
    booking: booking._id,
  });

  booking.paymentStatus = "paid";
  await booking.save();

  // Credit Driver Wallet based on configurable split
  const splitFraction = getDriverWalletSplitPercentage();
  const platformFeePct = Math.round((1 - splitFraction) * 100);
  const driverAmount = Math.round(booking.totalAmount * splitFraction * 100) / 100;
  await Driver.findByIdAndUpdate(booking.driver, { $inc: { walletBalance: driverAmount } });
  
  await WalletTransaction.create({
    owner: booking.driver,
    ownerModel: "Driver",
    type: "credit",
    amount: driverAmount,
    description: `Earnings for booking ${booking._id} (after ${platformFeePct}% fee)`,
    booking: booking._id,
  });

  const driverUser = await Driver.findById(booking.driver).select("name email");
  
  createNotification({
    userId: booking.driver, userModel: "Driver",
    title: "Payment Received",
    message: `Payment of ₹${booking.totalAmount} received (paid via Wallet). ₹${driverAmount.toFixed(2)} added to your wallet.`,
    type: "payment", link: `/bookings/${booking._id}`,
  }).catch(() => {});
  
  if (driverUser && updatedUser) sendBookingStatusUpdate(updatedUser, driverUser, booking, "paid").catch(() => {});

  publishKafkaEvent(KAFKA_TOPICS.PAYMENT_COMPLETED, String(booking._id), {
    bookingId: booking._id,
    driverId: booking.driver,
    userId: booking.user,
    totalAmount: booking.totalAmount,
    driverAmount,
    paymentMethod: "wallet",
  }).catch(() => {});

  res.json({ message: "Payment successful using wallet" });
};

export const verifyWebhook = async (req: any, res: Response) => {
  const signature = req.headers["x-razorpay-signature"] as string | undefined;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

  if (!webhookSecret) {
    return res.status(500).json({ message: "RAZORPAY_WEBHOOK_SECRET is not configured" });
  }

  if (!signature) {
    return res.status(400).json({ message: "Missing Razorpay signature header" });
  }

  // req.body is raw Buffer when handled by express.raw({ type: "application/json" })
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}));

  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody) // raw Buffer, not parsed JSON
    .digest("hex");

  const valid =
    Boolean(signature) &&
    expected.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));

  if (!valid) {
    return res.status(400).json({ message: "Invalid webhook signature" });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ message: "Invalid JSON payload" });
  }

  if (event.event === "payment.captured") {
    const paymentEntity = event.payload?.payment?.entity;
    if (!paymentEntity) {
      return res.status(400).json({ message: "Invalid payload: missing payment entity" });
    }

    const orderId = paymentEntity.order_id;
    const paymentId = paymentEntity.id;

    const payment = await Payment.findOne({ razorpayOrderId: orderId });
    if (!payment) {
      return res.status(200).json({ received: true, status: "ignored", message: "Payment order not found" });
    }

    if (payment.status === "completed") {
      return res.status(200).json({ received: true, status: "ok", message: "Already reconciled" });
    }

    // reuse the same atomic transition you already wrote in verifyPayment:
    const updated = await Payment.findOneAndUpdate(
      { _id: payment._id, status: "pending" },
      {
        $set: {
          razorpayPaymentId: paymentId,
          razorpaySignature: signature,
          status: "completed",
          paidAt: new Date(),
        },
      },
      { new: true }
    );

    if (updated) {
      await reconcilePayment(updated, "razorpay_webhook");
    }

    return res.status(200).json({ received: true, status: "ok", message: "Payment reconciled successfully" });
  }

  res.status(200).json({ received: true, status: "ok", message: "Event ignored" });
};

export const handleWebhook = verifyWebhook;
