import Driver from "../models/Driver.js";
import Booking from "../models/Booking.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../middleware/upload.js";
import { sanitizeDriver, clampLimit } from "../utils/sanitize.js";

const normalizeList = (val) =>
  Array.isArray(val)
    ? val
    : typeof val === "string"
      ? val.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getPublicStats = async (req, res, next) => {
  try {
    const [driverCount, completedTrips, cityAgg, ratingAgg] = await Promise.all([
      Driver.countDocuments({ isActive: true, kycStatus: "approved" }),
      Booking.countDocuments({ status: "completed" }),
      Driver.distinct("locality", { isActive: true, kycStatus: "approved", locality: { $ne: "" } }),
      Driver.aggregate([
        { $match: { isActive: true, kycStatus: "approved", totalReviews: { $gt: 0 } } },
        { $group: { _id: null, avgRating: { $avg: "$averageRating" } } },
      ]),
    ]);

    res.json({
      driverCount,
      tripCount: completedTrips,
      cityCount: cityAgg.length,
      averageRating: ratingAgg[0]?.avgRating
        ? Math.round(ratingAgg[0].avgRating * 10) / 10
        : 0,
    });
  } catch (error) {
    next(error);
  }
};

export const getDrivers = async (req, res, next) => {
  try {
    const {
      locality,
      minExperience,
      maxExperience,
      minRating,
      vehicleType,
      hireType,
      minRate,
      maxRate,
      languages,
      sort: sortParam,
      page = 1,
      limit = 12,
    } = req.query;

    const safeLimit = clampLimit(limit, 12, 50);

    const query = { isActive: true, profileCompleted: true, kycStatus: "approved", availability: "available" };

    if (locality) {
      query.locality = { $regex: escapeRegex(locality), $options: "i" };
    }
    if (minExperience || maxExperience) {
      query.experienceYears = {};
      if (minExperience) query.experienceYears.$gte = Number(minExperience);
      if (maxExperience) query.experienceYears.$lte = Number(maxExperience);
    }
    if (minRating) {
      query.averageRating = { $gte: Number(minRating) };
    }
    if (vehicleType) {
      query.vehicleTypes = { $in: vehicleType.split(",") };
    }
    if (languages) {
      query.languages = { $in: languages.split(",") };
    }
    if (hireType === "temporary" && (minRate || maxRate)) {
      if (minRate) query.hourlyRate = { ...query.hourlyRate, $gte: Number(minRate) };
      if (maxRate) query.hourlyRate = { ...query.hourlyRate, $lte: Number(maxRate) };
    } else if (hireType === "permanent" && (minRate || maxRate)) {
      if (minRate) query.dailyRate = { ...query.dailyRate, $gte: Number(minRate) };
      if (maxRate) query.dailyRate = { ...query.dailyRate, $lte: Number(maxRate) };
    }

    const skip = (Number(page) - 1) * safeLimit;

    const sortMap = {
      rating: { averageRating: -1, experienceYears: -1 },
      experience: { experienceYears: -1, averageRating: -1 },
      price_low: { hourlyRate: 1 },
      price_high: { hourlyRate: -1 },
      newest: { createdAt: -1 },
    };
    const sort = sortMap[sortParam] || sortMap.rating;

    const [drivers, total] = await Promise.all([
      Driver.find(query)
        .sort(sort)
        .skip(skip)
        .limit(safeLimit)
        .select("-password"),
      Driver.countDocuments(query),
    ]);

    res.json({
      drivers: drivers.map((d) => sanitizeDriver(d)),
      pagination: {
        page: Number(page),
        pages: Math.ceil(total / safeLimit),
        total,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getDriverById = async (req, res, next) => {
  try {
    const driver = await Driver.findById(req.params.id).select("-password");

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    res.json({ driver: sanitizeDriver(driver) });
  } catch (error) {
    next(error);
  }
};

export const updateDriverProfile = async (req, res, next) => {
  try {
    const updates = {};
    const allowedFields = [
      "name",
      "phone",
      "nationality",
      "locality",
      "experienceYears",
      "vehicleTypes",
      "hourlyRate",
      "dailyRate",
      "languages",
      "bio",
      "availability",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "languages" || field === "vehicleTypes") {
          updates[field] = normalizeList(req.body[field]);
        } else {
          updates[field] = req.body[field];
        }
      }
    });

    const existing = await Driver.findById(req.user._id);
    if (!existing) {
      return res.status(404).json({ message: "Driver not found" });
    }

    if (req.files?.licenseImage?.[0]) {
      const file = req.files.licenseImage[0];
      if (existing.licenseImage?.publicId) {
        deleteFromCloudinary(existing.licenseImage.publicId).catch(() => {});
      }
      const result = await uploadToCloudinary(file, "mymate/licenses");
      updates.licenseImage = { url: result.secure_url, publicId: result.public_id };
      if (existing.kycStatus === "approved" || req.body.resubmitKyc === "true") {
        updates.kycStatus = "pending";
        updates.isActive = false;
        updates.availability = "offline";
      }
    }

    if (req.files?.avatar?.[0]) {
      const file = req.files.avatar[0];
      if (existing.avatar?.publicId) {
        deleteFromCloudinary(existing.avatar.publicId).catch(() => {});
      }
      const result = await uploadToCloudinary(file, "mymate/avatars");
      updates.avatar = { url: result.secure_url, publicId: result.public_id };
    }

    if (existing.kycStatus === "approved") {
      const kycFields = ["licenseNumber", "experienceYears", "hourlyRate", "dailyRate"];
      const kycChanged = kycFields.some(
        (f) => updates[f] !== undefined && String(updates[f]) !== String(existing[f])
      );
      if (kycChanged) {
        updates.kycStatus = "pending";
        updates.isActive = false;
        updates.availability = "offline";
      }
    }

    const driver = await Driver.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    res.json({ driver: sanitizeDriver(driver, { withContact: true }) });
  } catch (error) {
    next(error);
  }
};