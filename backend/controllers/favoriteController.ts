// @ts-nocheck
import Favorite from "../models/Favorite.js";
import Driver from "../models/Driver.js";
import { sanitizeDriver } from "../utils/sanitize.js";

export const getFavorites = async (req, res) => {
  const favorites = await Favorite.find({ user: req.user._id }).populate("driver");
  const drivers = favorites
    .map((f) => f.driver)
    .filter(Boolean)
    .map((d) => sanitizeDriver(d));
  res.json({ favorites: drivers });
};

export const addFavorite = async (req, res) => {
  const { driverId } = req.body;
  const driver = await Driver.findById(driverId);
  if (!driver) return res.status(404).json({ message: "Driver not found" });
  try {
    await Favorite.create({ user: req.user._id, driver: driverId });
  } catch (err) {
    if (err.code === 11000) return res.status(200).json({ message: "Already saved" });
    throw err;
  }
  res.status(201).json({ message: "Added to favorites" });
};

export const removeFavorite = async (req, res) => {
  await Favorite.deleteOne({ user: req.user._id, driver: req.params.driverId });
  res.json({ message: "Removed from favorites" });
};

export const checkFavorite = async (req, res) => {
  const fav = await Favorite.findOne({
    user: req.user._id,
    driver: req.params.driverId,
  });
  res.json({ isFavorited: !!fav });
};
