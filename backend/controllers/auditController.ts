import { Request, Response } from "express";
import AuditLog from "../models/AuditLog.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const getAuditLogs = async (req: Request, res: Response) => {
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100).populate("user", "name email");
  return ApiResponse.success(res, { logs }, "Audit logs retrieved");
};

export const logAudit = async (user: any, userType: string, action: string, details: any, ipAddress: string) => {
  try {
    await AuditLog.create({
      user: user && user._id ? user._id : undefined,
      userType,
      action,
      details,
      ipAddress,
    });
  } catch (err) {
    console.error("Failed to write audit log", err);
  }
};
