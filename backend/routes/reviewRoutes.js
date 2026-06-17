import { Router } from "express";
import {
  createReview,
  getDriverReviews,
  updateReview,
  deleteReview,
} from "../controllers/reviewController.js";
import { protect, authorizeUser } from "../middleware/auth.js";
import { reviewValidator } from "../utils/validators.js";

const router = Router();

router.post("/", protect, authorizeUser, reviewValidator, createReview);
router.get("/driver/:driverId", getDriverReviews);
router.put("/:id", protect, authorizeUser, updateReview);
router.delete("/:id", protect, authorizeUser, deleteReview);

export default router;