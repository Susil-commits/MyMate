// @ts-nocheck
import { Request, Response } from "express";
import otplib from "otplib";
const { authenticator } = otplib;
import QRCode from "qrcode";
import User from "../models/User.js";
import Driver from "../models/Driver.js";
import { AppError } from "../utils/AppError.js";
import { generateToken, sendTokenResponse } from "../utils/token.js";

// Utility to get the correct model
const getModelByRole = (role: string) => {
  if (role === "driver") return Driver;
  if (role === "user") return User;
  throw new AppError("Invalid role", 400);
};

export const generate2FA = async (req: Request, res: Response) => {
  const { id, role } = req.user;
  const Model = getModelByRole(role);
  
  const user = await Model.findById(id);
  if (!user) throw new AppError("User not found", 404);
  
  const secret = authenticator.generateSecret();
  user.twoFactorSecret = secret;
  await user.save();
  
  const otpauth = authenticator.keyuri(user.email, "MyMate", secret);
  const qrCodeUrl = await QRCode.toDataURL(otpauth);
  
  res.status(200).json({
    success: true,
    qrCodeUrl,
    secret // Only send secret once for setup
  });
};

export const enable2FA = async (req: Request, res: Response) => {
  const { id, role } = req.user;
  const { token } = req.body;
  
  if (!token) throw new AppError("Token is required", 400);
  
  const Model = getModelByRole(role);
  const user = await Model.findById(id);
  if (!user) throw new AppError("User not found", 404);
  
  if (!user.twoFactorSecret) {
    throw new AppError("2FA is not initialized", 400);
  }
  
  const isValid = authenticator.verify({ token, secret: user.twoFactorSecret });
  if (!isValid) throw new AppError("Invalid 2FA token", 400);
  
  user.isTwoFactorEnabled = true;
  await user.save();
  
  res.status(200).json({
    success: true,
    message: "Two-Factor Authentication enabled successfully"
  });
};

export const verify2FALogin = async (req: Request, res: Response) => {
  const { email, token, role } = req.body;
  
  if (!email || !token || !role) {
    throw new AppError("Email, token, and role are required", 400);
  }
  
  const Model = getModelByRole(role);
  const user = await Model.findOne({ email: email.toLowerCase() });
  
  if (!user) throw new AppError("User not found", 404);
  if (!user.isTwoFactorEnabled || !user.twoFactorSecret) {
    throw new AppError("2FA is not enabled for this user", 400);
  }
  
  const isValid = authenticator.verify({ token, secret: user.twoFactorSecret });
  if (!isValid) throw new AppError("Invalid 2FA token", 400);
  
  sendTokenResponse(user, 200, res);
};
