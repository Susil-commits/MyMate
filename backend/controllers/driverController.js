import Driver from "../models/Driver.js";
import Booking from "../models/Booking.js";
import { sanitizeDriver, clampLimit } from "../utils/sanitize.js";
import { buildPagination } from "../utils/pagination.js";
import { storeFile, deleteFromCloudinary } from "../middleware/upload.js";

const SORT_MAP = {
  rating: { averageRating: -1, totalReviews: -1 },
  experience: { experienceYears: -1 },
  price_low: { hourlyRate: 1 },
  price_high: { hourlyRate: -1 },
  newest: { createdAt: -1 },
};

export const getDrivers = async (req, res) => {
  const {
    locality, minExperience, minRating, vehicleType, hireType,
    languages, minRate, maxRate, sort, page, limit,
  } = req.query;

  const filter = { kycStatus: "approved", isActive: true };

  if (locality) filter.locality = { $regex: locality, $options: "i" };
  if (minExperience) filter.experienceYears = { $gte: Number(minExperience) };
  if (minRating) filter.averageRating = { $gte: Number(minRating) };
  if (vehicleType) filter.vehicleTypes = vehicleType;
  if (languages) {
    const langs = String(languages).split(",").map((l) => l.trim()).filter(Boolean);
    if (langs.length) filter.languages = { $in: langs };
  }

  if (hireType) {
    const rateFilter = {};
    if (minRate) rateFilter.$gte = Number(minRate);
    if (maxRate) rateFilter.$lte = Number(maxRate);
    if (Object.keys(rateFilter).length) {
      if (hireType === "temporary") filter.hourlyRate = rateFilter;
      else filter.dailyRate = rateFilter;
    }
  }

  const sortOption = SORT_MAP[sort] || SORT_MAP.rating;
  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = clampLimit(limit, 12, 50);
  const skip = (pageNum - 1) * limitNum;

  const [total, drivers] = await Promise.all([
    Driver.countDocuments(filter),
    Driver.find(filter).sort(sortOption).skip(skip).limit(limitNum).lean(),
  ]);

  res.json({
    drivers: drivers.map((d) => sanitizeDriver(d)),
    pagination: buildPagination(total, pageNum, limitNum),
  });
};

export const getPublicStats = async (req, res) => {
  const [driverCount, tripCount, cityAgg, agg] = await Promise.all([
    Driver.countDocuments({ kycStatus: "approved", isActive: true }),
    Booking.countDocuments({ status: "completed" }),
    Driver.distinct("locality", { kycStatus: "approved", isActive: true, locality: { $ne: "" } }),
    Driver.aggregate([
      { $match: { kycStatus: "approved", isActive: true } },
      { $group: { _id: null, avgRating: { $avg: "$averageRating" } } },
    ]),
  ]);
  res.json({
    driverCount,
    tripCount,
    cityCount: cityAgg.length,
    averageRating: agg[0] ? Math.round(agg[0].avgRating * 10) / 10 : 0,
    totalDrivers: driverCount,
    availableDrivers: driverCount,
  });
};

export const getDriverById = async (req, res) => {
  const driver = await Driver.findById(req.params.id).lean();
  if (!driver) return res.status(404).json({ message: "Driver not found" });
  res.json({ driver: sanitizeDriver(driver) });
};

export const updateDriverProfile = async (req, res) => {
  const driver = await Driver.findById(req.user._id);
  const {
    name, phone, nationality, locality, experienceYears,
    hourlyRate, dailyRate, bio, availability, vehicleTypes, languages,
  } = req.body;

  if (name !== undefined) driver.name = name;
  if (phone !== undefined) driver.phone = phone;
  if (nationality !== undefined) driver.nationality = nationality;
  if (locality !== undefined) driver.locality = locality;
  if (experienceYears !== undefined) driver.experienceYears = Number(experienceYears);
  if (hourlyRate !== undefined) driver.hourlyRate = Number(hourlyRate);
  if (dailyRate !== undefined) driver.dailyRate = Number(dailyRate);
  if (bio !== undefined) driver.bio = bio;
  if (availability !== undefined) driver.availability = availability;
  if (vehicleTypes !== undefined) {
    driver.vehicleTypes = Array.isArray(vehicleTypes)
      ? vehicleTypes.filter(Boolean)
      : [vehicleTypes];
  }
  if (languages !== undefined) {
    driver.languages = String(languages)
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
  }

  const files = req.files || {};
  if (files.licenseImage && files.licenseImage[0]) {
    const oldPublicId = driver.licenseImage?.publicId;
    const { url, publicId } = await storeFile(files.licenseImage[0], "mymate/licenses", req);
    driver.licenseImage = { url, publicId };
    if (req.body.resubmitKyc === "true") driver.kycStatus = "pending";
    if (oldPublicId) deleteFromCloudinary(oldPublicId);
  }
  if (files.avatar && files.avatar[0]) {
    const oldPublicId = driver.avatar?.publicId;
    const { url, publicId } = await storeFile(files.avatar[0], "mymate/avatars", req);
    driver.avatar = { url, publicId };
    if (oldPublicId) deleteFromCloudinary(oldPublicId);
  }

  await driver.save();
  const sanitized = sanitizeDriver(driver, { withContact: true });
  res.json({ message: "Profile updated", driver: sanitized });
};
