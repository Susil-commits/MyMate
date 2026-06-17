import { Router } from "express";
import {
  createPaymentIntent,
  confirmPayment,
  getPaymentStatus,
} from "../controllers/paymentController.js";
import { protect, authorizeUser } from "../middleware/auth.js";

const router = Router();

router.post("/create-intent", protect, authorizeUser, createPaymentIntent);
router.post("/confirm", protect, authorizeUser, confirmPayment);
router.get("/booking/:bookingId", protect, getPaymentStatus);

export default router;