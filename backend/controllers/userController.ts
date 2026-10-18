import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import User from "../models/User.js";
import Driver from "../models/Driver.js";
import { generateToken } from "../utils/token.js";
import { storeFile, deleteFromCloudinary } from "../middleware/upload.js";
import { changePasswordSchema } from "../utils/validators.js";

export const getUserProfile = async (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
};

export const updateUserProfile = async (req: AuthRequest, res: Response) => {
  const user = await User.findById((req.user as any)?._id);
  if (!user) return res.status(404).json({ message: "User not found" });

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

export const changePassword = async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const Model = (req.userRole === "User" || req.userRole === "user" ? User : Driver) as any;
  const account = await Model.findById((req.user as any)?._id || (req.user as any)?.id).select("+password");
  if (!account) return res.status(404).json({ message: "Account not found" });

  const matched = await account.comparePassword(currentPassword);
  if (!matched) {
    return res.status(400).json({ message: "Current password is incorrect" });
  }

  account.password = newPassword;
  account.tokenVersion = (account.tokenVersion || 0) + 1;
  await account.save();

  const token = generateToken(account, req.userRole || "user");
  res.json({ token, message: "Password changed successfully" });
};
