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
import { idempotency } from "../middleware/idempotency.js";

const router = Router();

router.post("/create-order", protect, authorizeUser, paymentLimiter, idempotency, createOrder);
router.post("/verify", protect, authorizeUser, paymentLimiter, idempotency, verifyPayment);
router.get("/booking/:bookingId", protect, getPaymentStatus);
router.post("/refund", protect, authorizeAdmin, idempotency, refundPayment);
router.post("/wallet-pay", protect, authorizeUser, paymentLimiter, idempotency, payWithWallet);

export default router;
