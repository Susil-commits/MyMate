// @ts-nocheck
import User from "../models/User.js";
import Driver from "../models/Driver.js";
import { generateToken } from "../utils/token.js";
import { storeFile, deleteFromCloudinary } from "../middleware/upload.js";

export const getUserProfile = async (req, res) => {
  res.json({ user: req.user });
};

export const updateUserProfile = async (req, res) => {
  const user = await User.findById(req.user._id);
  const { name, phone, locality } = req.body;
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (locality !== undefined) user.locality = locality;

  if (req.file) {
    const oldPublicId = user.avatar?.publicId;
    const { url, publicId } = await storeFile(req.file, "mymate/avatars", req);
    user.avatar = { url, publicId };
    if (oldPublicId) deleteFromCloudinary(oldPublicId);
  }

  await user.save();
  res.json({ user });
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const Model = req.userRole === "driver" ? Driver : User;
  const account = await Model.findById(req.user._id).select("+password");
  if (!account) return res.status(404).json({ message: "Account not found" });

  const matched = await account.comparePassword(currentPassword);
  if (!matched) {
    return res.status(400).json({ message: "Current password is incorrect" });
  }

  account.password = newPassword;
  account.tokenVersion = (account.tokenVersion || 0) + 1;
  await account.save();

  const token = generateToken(account, req.userRole);
  res.json({ token, message: "Password changed successfully" });
};
