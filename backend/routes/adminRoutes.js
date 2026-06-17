import { Router } from "express";
import {
  getPendingDrivers,
  verifyDriver,
  getAllDrivers,
  getAllUsers,
  getAllBookings,
  getDashboardStats,
} from "../controllers/adminController.js";
import { protect, authorizeAdmin } from "../middleware/auth.js";

const router = Router();

router.use(protect, authorizeAdmin);

router.get("/stats", getDashboardStats);
router.get("/drivers", getAllDrivers);
router.get("/drivers/pending", getPendingDrivers);
router.put("/drivers/:id/verify", verifyDriver);
router.get("/users", getAllUsers);
router.get("/bookings", getAllBookings);

export default router;