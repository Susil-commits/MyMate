// @ts-nocheck
import { Router } from "express";
import {
  createOrder,
  verifyPayment,
  getPaymentStatus,
  refundPayment,
  payWithWallet,
} from "../controllers/paymentController.js";
import { protect, authorizeUser, authorizeAdmin } from "../middleware/auth.js";
import { paymentLimiter } from "../middleware/rateLimiter.js";

const router = Router();

router.post("/create-order", protect, authorizeUser, paymentLimiter, createOrder);
router.post("/verify", protect, authorizeUser, paymentLimiter, verifyPayment);
router.get("/booking/:bookingId", protect, getPaymentStatus);
router.post("/refund", protect, authorizeAdmin, refundPayment);
router.post("/wallet-pay", protect, authorizeUser, paymentLimiter, payWithWallet);

export default router;
