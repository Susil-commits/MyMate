// @ts-nocheck
import { Router } from "express";
import {
  getPendingDrivers,
  verifyDriver,
  getAllDrivers,
  getDriverDetail,
  getAllUsers,
  getAllBookings,
  toggleDriverActive,
  toggleUserActive,
  getDashboardStats,
  exportBookingsCSV,
} from "../controllers/adminController.js";
import { protect, authorizeAdmin } from "../middleware/auth.js";

const router = Router();

router.use(protect, authorizeAdmin);

router.get("/stats", getDashboardStats);
router.get("/drivers", getAllDrivers);
router.get("/drivers/pending", getPendingDrivers);
router.get("/drivers/:id", getDriverDetail);
router.put("/drivers/:id/verify", verifyDriver);
router.put("/drivers/:id/toggle-active", toggleDriverActive);
router.get("/users", getAllUsers);
router.put("/users/:id/toggle-active", toggleUserActive);
router.get("/bookings", getAllBookings);
router.get("/bookings/export", exportBookingsCSV);

export default router;