import Driver from "../models/Driver.js";
import { uploadToCloudinary } from "../middleware/upload.js";

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
      page = 1,
      limit = 12,
    } = req.query;

    const query = { isActive: true, profileCompleted: true, kycStatus: "approved", availability: { $ne: "offline" } };

    if (locality) {
      query.locality = { $regex: locality, $options: "i" };
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

    const skip = (Number(page) - 1) * Number(limit);

    const [drivers, total] = await Promise.all([
      Driver.find(query)
        .sort({ averageRating: -1, experienceYears: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select("-password"),
      Driver.countDocuments(query),
    ]);

    res.json({
      drivers,
      pagination: {
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getDriverById = async (req, res, next) => {
  try {
    const driver = await Driver.findById(req.params.id)
      .select("-password")
      .populate({
        path: "reviews",
        options: { sort: { createdAt: -1 }, limit: 10 },
        populate: { path: "user", select: "name" },
      });

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    res.json({ driver });
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
        updates[field] = req.body[field];
      }
    });

    if (req.file) {
      const result = await uploadToCloudinary(req.file, "mymate/licenses");
      updates.licenseImage = { url: result.secure_url, publicId: result.public_id };
      if (req.body.resubmitKyc === "true") {
        updates.kycStatus = "pending";
      }
    }

    const driver = await Driver.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    res.json({ driver });
  } catch (error) {
    next(error);
  }
};