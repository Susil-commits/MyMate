// @ts-nocheck
import crypto from "crypto";
import User from "../models/User.js";
import Driver from "../models/Driver.js";
import { generateToken } from "../utils/token.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../config/email.js";
import { storeFile } from "../middleware/upload.js";
import { sanitizeDriver } from "../utils/sanitize.js";

const VERIFY_EXPIRE = 24 * 60 * 60 * 1000;

function setTokenCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
}

function makeVerificationToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const hashed = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hashed };
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function attachVerification(account, role) {
  const { token, hashed } = makeVerificationToken();
  account.emailVerificationToken = hashed;
  account.emailVerificationExpire = Date.now() + VERIFY_EXPIRE;
  await account.save();
  sendVerificationEmail(account.email, token, role).catch(() => {});
}

export const userRegister = async (req, res) => {
  const { email, password, gender, phone } = req.body;
  const user = new User({ email, password, gender, phone });
  await user.save();
  await attachVerification(user, "user");
  res.status(201).json({ message: "Account created. Please verify your email." });
};

export const userLogin = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }
  if (!user.isActive) {
    return res.status(403).json({ message: "Your account has been deactivated. Contact support." });
  }
  const token = generateToken(user, "user");
  setTokenCookie(res, token);
  res.json({ role: "user", user, needsProfileCompletion: !user.profileCompleted });
};

export const completeUserProfile = async (req, res) => {
  const { name, locality } = req.body;
  const user = await User.findById(req.user._id);
  user.name = name;
  user.locality = locality;
  user.profileCompleted = true;
  await user.save();
  res.json({ user });
};

export const driverRegister = async (req, res) => {
  const { email, password, gender, phone } = req.body;
  const driver = new Driver({ email, password, gender, phone });
  await driver.save();
  await attachVerification(driver, "driver");
  res.status(201).json({ message: "Driver account created. Please verify your email." });
};

export const driverLogin = async (req, res) => {
  const { email, password } = req.body;
  const driver = await Driver.findOne({ email: String(email).toLowerCase() });
  if (!driver || !(await driver.comparePassword(password))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }
  const token = generateToken(driver, "driver");
  setTokenCookie(res, token);
  res.json({ role: "driver", driver, needsProfileCompletion: !driver.profileCompleted });
};

export const completeDriverProfile = async (req, res) => {
  const driver = await Driver.findById(req.user._id);
  const {
    name, nationality, locality, licenseNumber, experienceYears,
    hourlyRate, dailyRate, languages, bio, vehicleTypes,
  } = req.body;

  if (name !== undefined) driver.name = name;
  if (nationality !== undefined) driver.nationality = nationality;
  if (locality !== undefined) driver.locality = locality;
  if (licenseNumber !== undefined) driver.licenseNumber = licenseNumber;
  if (experienceYears !== undefined) driver.experienceYears = Number(experienceYears);
  if (hourlyRate !== undefined) driver.hourlyRate = Number(hourlyRate);
  if (dailyRate !== undefined) driver.dailyRate = Number(dailyRate);
  if (bio !== undefined) driver.bio = bio;
  if (vehicleTypes !== undefined) {
    driver.vehicleTypes = Array.isArray(vehicleTypes) ? vehicleTypes.filter(Boolean) : [vehicleTypes];
  }
  if (languages !== undefined) {
    driver.languages = String(languages)
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
  }

  if (req.file) {
    const { url, publicId } = await storeFile(req.file, "mymate/licenses", req);
    driver.licenseImage = { url, publicId };
  }

  driver.profileCompleted = true;
  driver.kycStatus = "pending";
  await driver.save();
  res.json({ driver: sanitizeDriver(driver, { withContact: true }) });
};

export const adminLogin = async (req, res) => {
  const { code } = req.body;
  if (!process.env.ADMIN_CODE || code !== process.env.ADMIN_CODE) {
    return res.status(401).json({ message: "Invalid admin code" });
  }
  const token = generateToken(null, "admin");
  setTokenCookie(res, token);
  res.json({ role: "admin" });
};

export const logout = (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0),
  });
  res.json({ message: "Logged out successfully" });
};

export const getMe = async (req, res) => {
  res.json({ user: req.user, role: req.userRole });
};

export const forgotPassword = async (req, res) => {
  const { email, role } = req.body;
  const Model = role === "driver" ? Driver : User;
  const account = await Model.findOne({ email: String(email).toLowerCase() });
  if (account) {
    const resetToken = account.getResetPasswordToken();
    await account.save();
    sendPasswordResetEmail(account.email, resetToken).catch(() => {});
  }
  res.json({ message: "If an account exists, a reset link has been sent" });
};

export const resetPassword = async (req, res) => {
  const { token, password, role } = req.body;
  const Model = role === "driver" ? Driver : User;
  const account = await Model.findOne({
    resetPasswordToken: hashToken(token),
    resetPasswordExpire: { $gt: Date.now() },
  });
  if (!account) {
    return res.status(400).json({ message: "Invalid or expired reset token" });
  }
  account.password = password;
  account.resetPasswordToken = undefined;
  account.resetPasswordExpire = undefined;
  account.tokenVersion = (account.tokenVersion || 0) + 1;
  await account.save();
  const newToken = generateToken(account, role);
  setTokenCookie(res, newToken);
  res.json({ role });
};

export const verifyEmail = async (req, res) => {
  const { token, role } = req.body;
  const Model = role === "driver" ? Driver : User;
  const account = await Model.findOne({
    emailVerificationToken: hashToken(token),
    emailVerificationExpire: { $gt: Date.now() },
  });
  if (!account) {
    return res.status(400).json({ message: "Invalid or expired verification token" });
  }
  account.isEmailVerified = true;
  account.emailVerificationToken = undefined;
  account.emailVerificationExpire = undefined;
  await account.save();
  res.json({ message: "Email verified successfully" });
};

export const resendVerification = async (req, res) => {
  const { email, role } = req.body;
  const Model = role === "driver" ? Driver : User;
  const account = await Model.findOne({ email: String(email).toLowerCase() });
  if (account && !account.isEmailVerified) {
    await attachVerification(account, role);
  }
  res.json({ message: "If the email exists and is unverified, a new link has been sent" });
};
