import Favorite from "../models/Favorite.js";
import { sanitizeDriver } from "../utils/sanitize.js";

export const getFavorites = async (req, res, next) => {
  try {
    const favorites = await Favorite.find({ user: req.user._id })
      .populate("driver", "-password")
      .sort({ createdAt: -1 });
    res.json({ favorites: favorites.map((f) => sanitizeDriver(f.driver)).filter(Boolean) });
  } catch (error) {
    next(error);
  }
};

export const addFavorite = async (req, res, next) => {
  try {
    const { driverId } = req.body;
    const existing = await Favorite.findOne({ user: req.user._id, driver: driverId });
    if (existing) {
      return res.status(400).json({ message: "Already in favorites" });
    }
    await Favorite.create({ user: req.user._id, driver: driverId });
    res.status(201).json({ message: "Added to favorites" });
  } catch (error) {
    next(error);
  }
};

export const removeFavorite = async (req, res, next) => {
  try {
    await Favorite.findOneAndDelete({ user: req.user._id, driver: req.params.driverId });
    res.json({ message: "Removed from favorites" });
  } catch (error) {
    next(error);
  }
};

export const checkFavorite = async (req, res, next) => {
  try {
    const fav = await Favorite.findOne({ user: req.user._id, driver: req.params.driverId });
    res.json({ isFavorited: !!fav });
  } catch (error) {
    next(error);
  }
};