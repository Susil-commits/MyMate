import { Router } from "express";
import {
  getPendingDrivers,
  verifyDriver,
  getAllDrivers,
  getDriverDetail,
  getAllUsers,
  getAllBookings,
  toggleDriverActive,
  getDashboardStats,
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
router.get("/bookings", getAllBookings);

export default router;