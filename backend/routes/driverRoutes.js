import { Router } from "express";
import {
  getDrivers,
  getDriverById,
  updateDriverProfile,
} from "../controllers/driverController.js";
import { protect, authorizeDriver } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = Router();

router.get("/", getDrivers);
router.get("/:id", getDriverById);
router.put("/profile", protect, authorizeDriver, upload.single("licenseImage"), updateDriverProfile);

export default router;