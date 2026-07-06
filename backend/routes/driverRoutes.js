import { Router } from "express";
import {
  getDrivers,
  getDriverById,
  updateDriverProfile,
  getPublicStats,
} from "../controllers/driverController.js";
import { protect, authorizeDriver } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = Router();

router.get("/", getDrivers);
router.get("/stats", getPublicStats);
router.get("/:id", getDriverById);
router.put("/profile", protect, authorizeDriver, upload.fields([
  { name: "licenseImage", maxCount: 1 },
  { name: "avatar", maxCount: 1 },
]), updateDriverProfile);

export default router;