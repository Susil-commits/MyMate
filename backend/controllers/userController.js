import User from "../models/User.js";
import Driver from "../models/Driver.js";
import jwt from "jsonwebtoken";
import { uploadToCloudinary, deleteFromCloudinary } from "../middleware/upload.js";

export const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch (error) {
    next(error);
  }
};

export const updateUserProfile = async (req, res, next) => {
  try {
    const updates = {};
    const allowedFields = ["name", "phone", "locality"];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (req.file) {
      const existing = await User.findById(req.user._id);
      if (existing?.avatar?.publicId) {
        deleteFromCloudinary(existing.avatar.publicId).catch(() => {});
      }
      const result = await uploadToCloudinary(req.file, "mymate/avatars");
      updates.avatar = { url: result.secure_url, publicId: result.public_id };
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true, runValidators: true,
    }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "Current password and new password (min 6 chars) required" });
    }

    const Model = req.userRole === "driver" ? Driver : User;
    const user = await Model.findById(req.user._id);
    if (!user || !(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.password = newPassword;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    const newToken = jwt.sign(
      { id: user._id, role: req.userRole, tv: user.tokenVersion },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({ message: "Password changed successfully", token: newToken });
  } catch (error) {
    next(error);
  }
};