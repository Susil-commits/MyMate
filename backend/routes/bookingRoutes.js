import { Router } from "express";
import {
  createBooking,
  getUserBookings,
  getDriverBookings,
  getDriverStats,
  updateBookingStatus,
  getBookingById,
} from "../controllers/bookingController.js";
import { protect, authorizeUser } from "../middleware/auth.js";
import { bookingValidator } from "../utils/validators.js";

const router = Router();

router.post("/", protect, authorizeUser, bookingValidator, createBooking);
router.get("/user", protect, authorizeUser, getUserBookings);
router.get("/driver/stats", protect, getDriverStats);
router.get("/driver", protect, getDriverBookings);
router.get("/:id", protect, getBookingById);
router.put("/:id/status", protect, updateBookingStatus);

export default router;