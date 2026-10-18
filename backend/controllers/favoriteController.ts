import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import Favorite from "../models/Favorite.js";
import Driver from "../models/Driver.js";
import { sanitizeDriver } from "../utils/sanitize.js";

export const getFavorites = async (req: AuthRequest, res: Response) => {
  const favorites = await Favorite.find({ user: (req.user as any)?._id }).populate("driver");
  const drivers = favorites
    .map((f) => f.driver)
    .filter(Boolean)
    .map((d) => sanitizeDriver(d as any));
  res.json({ favorites: drivers });
};

export const addFavorite = async (req: AuthRequest, res: Response) => {
  const { driverId } = req.body;
  const driver = await Driver.findById(driverId);
  if (!driver) return res.status(404).json({ message: "Driver not found" });
  try {
    await Favorite.create({ user: (req.user as any)?._id, driver: driverId });
  } catch (err: any) {
    if (err.code === 11000) return res.status(200).json({ message: "Already saved" });
    throw err;
  }
  res.status(201).json({ message: "Added to favorites" });
};

export const removeFavorite = async (req: AuthRequest, res: Response) => {
  await Favorite.deleteOne({ user: (req.user as any)?._id, driver: req.params.driverId });
  res.json({ message: "Removed from favorites" });
};

export const checkFavorite = async (req: AuthRequest, res: Response) => {
  const fav = await Favorite.findOne({
    user: (req.user as any)?._id,
    driver: req.params.driverId,
  });
  res.json({ isFavorited: !!fav });
};
