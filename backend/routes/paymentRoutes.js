import { Router } from "express";
import {
  createOrder,
  verifyPayment,
  getPaymentStatus,
  refundPayment,
} from "../controllers/paymentController.js";
import { protect, authorizeUser, authorizeAdmin } from "../middleware/auth.js";

const router = Router();

router.post("/create-order", protect, authorizeUser, createOrder);
router.post("/verify", protect, authorizeUser, verifyPayment);
router.get("/booking/:bookingId", protect, getPaymentStatus);
router.post("/refund", protect, authorizeAdmin, refundPayment);

export default router;
