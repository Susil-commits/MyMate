import Driver from "../models/Driver.js";
import Booking from "../models/Booking.js";
import WalletTransaction from "../models/WalletTransaction.js";
import { sanitizeDriver, clampLimit } from "../utils/sanitize.js";
import { buildPagination } from "../utils/pagination.js";
import { storeFile, deleteFromCloudinary } from "../middleware/upload.js";
// Bug 19 Fix: Import clearCachePrefix statically at the module level instead of
// using dynamic import() inside the response handler. Dynamic import inside a
// controller causes a new module resolution on every profile update.
import { clearCachePrefix } from "../middleware/cache.js";

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
    languages, minRate, maxRate, sort, page, limit, search,
  } = req.query;

  const filter: any = { kycStatus: "approved", isActive: true };

  // Phase 5: MongoDB Full-Text Search
  if (search) {
    filter.$text = { $search: String(search) };
  }

  if (locality) filter.locality = { $regex: locality, $options: "i" };
  if (minExperience) (filter as any).experienceYears = { $gte: Number(minExperience) };
  if (minRating) (filter as any).averageRating = { $gte: Number(minRating) };
  if (vehicleType) {
    const types = String(vehicleType).split(",").map((t) => t.trim()).filter(Boolean);
    if (types.length) filter.vehicleTypes = { $in: types };
  }
  if (languages) {
    const langs = String(languages).split(",").map((l) => l.trim()).filter(Boolean);
    if (langs.length) filter.languages = { $in: langs };
  }

  if (hireType) {
    const rateFilter: any = {};
    if (minRate) rateFilter.$gte = Number(minRate);
    if (maxRate) rateFilter.$lte = Number(maxRate);
    if (Object.keys(rateFilter).length) {
      if (hireType === "temporary") filter.hourlyRate = rateFilter;
      else filter.dailyRate = rateFilter;
    }
  }

  let sortOption = SORT_MAP[sort] || SORT_MAP.rating;
  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = clampLimit(limit, 12, 50);
  const skip = (pageNum - 1) * limitNum;

  let query = Driver.find(filter);
  
  if (search) {
    // Project and sort by text score
    query = query.select({ score: { $meta: "textScore" } });
    if (!sort) {
      sortOption = { score: { $meta: "textScore" } } as any;
    }
  }

  const [total, drivers] = await Promise.all([
    Driver.countDocuments(filter),
    query.sort(sortOption).skip(skip).limit(limitNum).lean(),
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
    
    // Bug 13 Fix: Removed OCR auto-approval logic. Any image containing the words
    // "ID", "DRIVING", or "LICENSE" (including fake/forged documents, business cards,
    // or marketing materials) would have been automatically approved — a major KYC bypass.
    //
    // OCR analysis is now purely informational: it logs detected keywords for admin review
    // but NEVER auto-sets kycStatus to "approved". Human admin review is always required.
    if (req.body.resubmitKyc === "true") {
      driver.kycStatus = "pending";
      const driverId = driver._id;
      const capturedUrl = url;

      // Run OCR in background — info only, does not affect kycStatus
      Promise.resolve().then(async () => {
        try {
          const Tesseract = (await import("tesseract.js")).default;
          const { data: { text } } = await Tesseract.recognize(capturedUrl, "eng");
          const upperText = text.toUpperCase();
          const detectedKeywords = ["DRIVING", "LICENCE", "LICENSE", "DOB"].filter(
            (kw) => upperText.includes(kw)
          );
          if (detectedKeywords.length > 0) {
            console.log(`[OCR] Driver ${driverId}: detected keywords [${detectedKeywords.join(", ")}]. Pending admin review.`);
          } else {
            console.log(`[OCR] Driver ${driverId}: no license keywords detected. Manual review required.`);
          }
        } catch (err) {
          console.error("[OCR] Failed to analyze license:", err);
        }
      });
    }
    
    if (oldPublicId) deleteFromCloudinary(oldPublicId);
  }
  if (files.avatar && files.avatar[0]) {
    const oldPublicId = driver.avatar?.publicId;
    const { url, publicId } = await storeFile(files.avatar[0], "mymate/avatars", req);
    driver.avatar = { url, publicId };
    if (oldPublicId) deleteFromCloudinary(oldPublicId);
  }

  await driver.save();
  
  // Bug 19 Fix: Use statically-imported clearCachePrefix instead of dynamic import()
  try {
    clearCachePrefix("drivers");
    clearCachePrefix("stats");
  } catch (err) {
    console.error("Failed to invalidate cache:", err);
  }

  const sanitized = sanitizeDriver(driver, { withContact: true });
  res.json({ message: "Profile updated", driver: sanitized });
};

export const getWalletTransactions = async (req, res) => {
  const driver = await Driver.findById(req.user._id).select("walletBalance");
  if (!driver) return res.status(404).json({ message: "Driver not found" });

  const transactions = await WalletTransaction.find({ driver: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate({
      path: "booking",
      select: "pickupLocation dropLocation status",
    });

  res.json({
    walletBalance: driver.walletBalance || 0,
    transactions,
  });
};
