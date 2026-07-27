import express from "express";
import { getPromoCodes, validatePromoCode, createPromoCode } from "../controllers/promoController.js";
import { protect as authenticate } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);
router.get("/", getPromoCodes);
router.post("/validate", validatePromoCode);
router.post("/create", createPromoCode); // Ideally secured with admin middleware

export default router;
