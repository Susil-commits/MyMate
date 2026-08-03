import { Request, Response } from "express";
import WalletTransaction from "../models/WalletTransaction.js";
import User from "../models/User.js";
import Driver from "../models/Driver.js";
import crypto from "crypto";

// Bug 4 Fix: Do NOT instantiate Razorpay at module load time with empty-string fallbacks.
// If RAZORPAY_KEY_ID is not set at startup, the old code created a bad Razorpay instance.
// Use lazy initialisation: only create on first call, after confirming env vars exist.
import Razorpay from "razorpay";
let _razorpay: InstanceType<typeof Razorpay> | null = null;
function getRazorpay(): InstanceType<typeof Razorpay> | null {
  if (_razorpay) return _razorpay;
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    _razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return _razorpay;
}

export const getWalletTransactions = async (req: Request, res: Response) => {
  try {
    // Bug 20 Fix: Use req.user._id (ObjectId) instead of req.user?.id (string virtual).
    // While Mongoose's .id virtual works for findById, it's inconsistent with all other
    // controllers and can cause subtle type mismatches in aggregation pipelines.
    const ownerId = (req as any).user?._id;
    const ownerRole = (req as any).user?.role || (req as any).userRole;
    const ownerModel = ownerRole === "driver" ? "Driver" : "User";

    const transactions = await WalletTransaction.find({ owner: ownerId, ownerModel })
      .sort({ createdAt: -1 })
      .limit(50);

    let balance = 0;
    if (ownerModel === "Driver") {
      const driver = await Driver.findById(ownerId).select("walletBalance");
      balance = driver?.walletBalance || 0;
    } else {
      const user = await User.findById(ownerId).select("walletBalance");
      balance = user?.walletBalance || 0;
    }

    res.json({ balance, transactions });
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: (err as Error).message });
  }
};

export const createWalletOrder = async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid amount" });

    const rzp = getRazorpay();
    if (!rzp) {
      return res.status(400).json({ message: "Payment gateway not configured" });
    }

    const options = {
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `wallet_rcpt_${Date.now()}`,
    };

    const order = await rzp.orders.create(options);
    res.json({ orderId: order.id, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    res.status(500).json({ message: "Failed to create order", error: (err as Error).message });
  }
};

export const verifyWalletPayment = async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(400).json({ message: "Payment gateway not configured" });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    // Bug 20 Fix: Use req.user._id consistently
    const ownerId = (req as any).user?._id;
    const ownerRole = (req as any).user?.role || (req as any).userRole;
    const ownerModel = ownerRole === "driver" ? "Driver" : "User";

    // Add to wallet
    if (ownerModel === "Driver") {
      await Driver.findByIdAndUpdate(ownerId, { $inc: { walletBalance: amount } });
    } else {
      await User.findByIdAndUpdate(ownerId, { $inc: { walletBalance: amount } });
    }

    await WalletTransaction.create({
      owner: ownerId,
      ownerModel,
      amount,
      type: "credit",
      description: "Wallet recharge via Razorpay",
      booking: undefined,
    });

    res.json({ success: true, message: "Wallet recharged successfully" });
  } catch (err) {
    res.status(500).json({ message: "Payment verification failed", error: (err as Error).message });
  }
};
