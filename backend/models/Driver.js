import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const driverSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    gender: { type: String, enum: ["male", "female", "other", ""], default: "" },
    phone: { type: String, trim: true, default: "" },
    nationality: { type: String, trim: true, default: "" },
    locality: { type: String, trim: true, default: "" },
    licenseNumber: { type: String, trim: true, default: "", sparse: true },
    licenseImage: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    experienceYears: { type: Number, default: 0, min: 0 },
    vehicleTypes: {
      type: [String],
      enum: ["Car", "SUV", "Van", "Truck", "Bus", "Auto", "Bike"],
    },
    availability: {
      type: String,
      enum: ["available", "busy", "offline"],
      default: "offline",
    },
    hourlyRate: { type: Number, default: 0, min: 0 },
    dailyRate: { type: Number, default: 0, min: 0 },
    languages: [{ type: String, trim: true }],
    bio: { type: String, default: "", maxlength: 500 },
    profileCompleted: { type: Boolean, default: false },
    kycStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    isActive: { type: Boolean, default: false },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    role: { type: String, default: "driver", enum: ["driver"] },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  { timestamps: true }
);

driverSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

driverSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

driverSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  this.resetPasswordExpire = Date.now() + 3600000;
  return resetToken;
};

driverSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpire;
  return obj;
};

driverSchema.index({ locality: 1, averageRating: -1, experienceYears: -1 });

export default mongoose.model("Driver", driverSchema);