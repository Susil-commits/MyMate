// @ts-nocheck
import { Router } from "express";
import { getFavorites, addFavorite, removeFavorite, checkFavorite } from "../controllers/favoriteController.js";
import { protect, authorizeUser } from "../middleware/auth.js";

const router = Router();

router.get("/", protect, authorizeUser, getFavorites);
router.post("/", protect, authorizeUser, addFavorite);
router.delete("/:driverId", protect, authorizeUser, removeFavorite);
router.get("/check/:driverId", protect, authorizeUser, checkFavorite);

export default router;