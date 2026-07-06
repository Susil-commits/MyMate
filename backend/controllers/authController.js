import jwt from "jsonwebtoken";
import crypto from "crypto";
import { validationResult } from "express-validator";
import User from "../models/User.js";
import Driver from "../models/Driver.js";
import { uploadToCloudinary } from "../middleware/upload.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../config/email.js";

const generateToken = (id, role, tokenVersion = 0) => {
  return jwt.sign({ id, role, tv: tokenVersion }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

const getEmailVerificationToken = function () {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    token,
    hash: crypto.createHash("sha256").update(token).digest("hex"),
    expire: Date.now() + 86400000,
  };
};

export const userRegister = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, gender, phone } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const user = await User.create({ email, password, gender, phone });

    const verif = getEmailVerificationToken();
    user.emailVerificationToken = verif.hash;
    user.emailVerificationExpire = verif.expire;
    await user.save({ validateBeforeSave: false });
    sendVerificationEmail(user.email, verif.token, "user").catch(() => {});

    res.status(201).json({ message: "Account created. Please verify your email, then login.", redirectTo: "/user/login" });
  } catch (error) {
    next(error);
  }
};

export const userLogin = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Your account has been deactivated. Please contact support." });
    }

    const token = generateToken(user._id, "user", user.tokenVersion);
    res.json({ user, token, role: "user", needsProfileCompletion: !user.profileCompleted });
  } catch (error) {
    next(error);
  }
};

export const completeUserProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, locality } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, locality, profileCompleted: true },
      { new: true, runValidators: true }
    ).select("-password");

    res.json({ user });
  } catch (error) {
    next(error);
  }
};

export const driverRegister = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, gender, phone } = req.body;

    const existingDriver = await Driver.findOne({ email });
    if (existingDriver) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const driver = await Driver.create({ email, password, gender, phone });

    const verif = getEmailVerificationToken();
    driver.emailVerificationToken = verif.hash;
    driver.emailVerificationExpire = verif.expire;
    await driver.save({ validateBeforeSave: false });
    sendVerificationEmail(driver.email, verif.token, "driver").catch(() => {});

    res.status(201).json({ message: "Driver account created. Please verify your email, then login.", redirectTo: "/driver/login" });
  } catch (error) {
    next(error);
  }
};

export const driverLogin = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const driver = await Driver.findOne({ email });
    if (!driver || !(await driver.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (driver.kycStatus === "approved" && !driver.isActive) {
      return res.status(403).json({ message: "Your account has been deactivated. Please contact support." });
    }

    const token = generateToken(driver._id, "driver", driver.tokenVersion);
    res.json({ driver, token, role: "driver", needsProfileCompletion: !driver.profileCompleted });
  } catch (error) {
    next(error);
  }
};

export const completeDriverProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      nationality,
      locality,
      licenseNumber,
      experienceYears,
      vehicleTypes,
      hourlyRate,
      dailyRate,
      languages,
      bio,
    } = req.body;

    let licenseImage = {};
    if (req.file) {
      const result = await uploadToCloudinary(req.file, "mymate/licenses");
      licenseImage = { url: result.secure_url, publicId: result.public_id };
    }

    const existing = await Driver.findById(req.user._id);
    const wasCompleted = existing?.profileCompleted === true;

    const normalizeList = (val) =>
      Array.isArray(val)
        ? val
        : typeof val === "string"
          ? val.split(",").map((s) => s.trim()).filter(Boolean)
          : [];

    const driver = await Driver.findByIdAndUpdate(
      req.user._id,
      {
        name,
        nationality,
        locality,
        licenseNumber,
        licenseImage: req.file ? licenseImage : undefined,
        experienceYears: Number(experienceYears),
        vehicleTypes: normalizeList(vehicleTypes),
        hourlyRate: Number(hourlyRate),
        dailyRate: Number(dailyRate),
        languages: normalizeList(languages),
        bio: bio || "",
        profileCompleted: true,
        kycStatus: wasCompleted ? existing.kycStatus : "pending",
      },
      { new: true, runValidators: true }
    ).select("-password");

    res.json({ driver });
  } catch (error) {
    next(error);
  }
};

export const adminLogin = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { code } = req.body;
    const adminCode = process.env.ADMIN_CODE || "";

    if (
      adminCode.length !== code.length ||
      !crypto.timingSafeEqual(Buffer.from(code), Buffer.from(adminCode))
    ) {
      return res.status(401).json({ message: "Invalid admin code" });
    }

    const token = generateToken("admin", "admin");
    res.json({ token, role: "admin" });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email, role } = req.body;

    const Model = role === "driver" ? Driver : User;
    const user = await Model.findOne({ email });

    if (!user) {
      return res.status(200).json({ message: "If the email exists, a reset link has been sent" });
    }

    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    await sendPasswordResetEmail(user.email, resetToken);

    res.json({ message: "If the email exists, a reset link has been sent" });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, password, role } = req.body;

    const resetPasswordToken = crypto.createHash("sha256").update(token).digest("hex");

    const Model = role === "driver" ? Driver : User;
    const user = await Model.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    const jwtToken = generateToken(user._id, role, user.tokenVersion);
    res.json({ token: jwtToken, role, message: "Password reset successful" });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const { token, role } = req.body;
    if (!token || !role) {
      return res.status(400).json({ message: "Token and role are required" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const Model = role === "driver" ? Driver : User;

    const user = await Model.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired verification token" });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save({ validateBeforeSave: false });

    res.json({ message: "Email verified successfully. You can now log in." });
  } catch (error) {
    next(error);
  }
};

export const resendVerification = async (req, res, next) => {
  try {
    const { email, role } = req.body;
    const Model = role === "driver" ? Driver : User;
    const user = await Model.findOne({ email });

    if (!user) {
      return res.status(200).json({ message: "If the email exists, a verification link has been sent" });
    }
    if (user.isEmailVerified) {
      return res.json({ message: "Email is already verified" });
    }

    const verif = getEmailVerificationToken();
    user.emailVerificationToken = verif.hash;
    user.emailVerificationExpire = verif.expire;
    await user.save({ validateBeforeSave: false });
    sendVerificationEmail(user.email, verif.token, role).catch(() => {});

    res.json({ message: "If the email exists, a verification link has been sent" });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    if (req.userRole === "admin") {
      return res.json({ user: { name: "Administrator", role: "admin" }, role: "admin" });
    }
    const Model = req.userRole === "driver" ? Driver : User;
    const user = await Model.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ user, role: req.userRole });
  } catch (error) {
    next(error);
  }
};