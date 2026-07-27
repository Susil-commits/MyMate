import express from "express";
import { getWalletTransactions, createWalletOrder, verifyWalletPayment } from "../controllers/walletController.js";
import { protect as authenticate } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);
router.get("/", getWalletTransactions);
router.post("/order", createWalletOrder);
router.post("/verify", verifyWalletPayment);

export default router;
