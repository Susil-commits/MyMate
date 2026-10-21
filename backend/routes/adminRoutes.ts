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
  getAdminHeatmap,
  getAdminMetrics,
  softDeleteUser,
  softDeleteDriver,
} from "../controllers/adminController.js";
import { protect, authorizeAdmin } from "../middleware/auth.js";

const router = Router();

router.use(protect, authorizeAdmin);

router.get("/stats", getDashboardStats);
router.get("/metrics", getAdminMetrics);
router.get("/heatmap", getAdminHeatmap);
router.get("/drivers", getAllDrivers);
router.get("/drivers/pending", getPendingDrivers);
router.get("/drivers/:id", getDriverDetail);
router.put("/drivers/:id/verify", verifyDriver);
router.put("/drivers/:id/toggle-active", toggleDriverActive);
router.delete("/drivers/:id", softDeleteDriver);
router.get("/users", getAllUsers);
router.put("/users/:id/toggle-active", toggleUserActive);
router.delete("/users/:id", softDeleteUser);
router.get("/bookings", getAllBookings);
router.get("/bookings/export", exportBookingsCSV);

export default router;