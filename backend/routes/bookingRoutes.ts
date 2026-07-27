// @ts-nocheck
import { Router } from "express";
import {
  createBooking,
  getUserBookings,
  getDriverBookings,
  getDriverStats,
  updateBookingStatus,
  getBookingById,
  downloadCalendar,
  downloadInvoice,
} from "../controllers/bookingController.js";
import { protect, authorizeUser, authorizeDriver } from "../middleware/auth.js";
import { bookingValidator } from "../utils/validators.js";

const router = Router();

router.post("/", protect, authorizeUser, bookingValidator, createBooking);
router.get("/user", protect, authorizeUser, getUserBookings);
router.get("/driver/stats", protect, authorizeDriver, getDriverStats);
router.get("/driver", protect, authorizeDriver, getDriverBookings);
router.get("/:id", protect, getBookingById);
router.get("/:id/calendar", protect, downloadCalendar);
router.get("/:id/invoice", protect, downloadInvoice);
router.put("/:id/status", protect, updateBookingStatus);

export default router;