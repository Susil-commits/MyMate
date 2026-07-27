// @ts-nocheck
import { Request, Response } from "express";
import PromoCode from "../models/PromoCode.js";

export const getPromoCodes = async (req: Request, res: Response) => {
  try {
    const promos = await PromoCode.find({ isActive: true, expiryDate: { $gt: new Date() } });
    res.json({ promos });
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: (err as Error).message });
  }
};

export const validatePromoCode = async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: "Promo code is required" });

    const promo = await PromoCode.findOne({
      code: code.toUpperCase(),
      isActive: true,
      expiryDate: { $gt: new Date() }
    });

    if (!promo) {
      return res.status(404).json({ message: "Invalid or expired promo code" });
    }

    if (promo.usageLimit && promo.usedCount >= promo.usageLimit) {
      return res.status(400).json({ message: "Promo code usage limit reached" });
    }

    res.json({ promo });
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: (err as Error).message });
  }
};

// Admin only (for seeding/management)
export const createPromoCode = async (req: Request, res: Response) => {
  try {
    const { code, discountPercentage, maxDiscount, expiryDate, usageLimit } = req.body;
    const existing = await PromoCode.findOne({ code: code.toUpperCase() });
    if (existing) return res.status(400).json({ message: "Promo code already exists" });

    const promo = await PromoCode.create({
      code: code.toUpperCase(),
      discountPercentage,
      maxDiscount,
      expiryDate,
      usageLimit,
    });
    res.status(201).json({ promo });
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: (err as Error).message });
  }
};
