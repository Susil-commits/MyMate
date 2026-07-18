// @ts-nocheck
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Driver from "../models/Driver.js";
import { Request, Response, NextFunction } from "express";

export interface AuthRequest extends Request {
  user?: any;
  userRole?: string;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);

    if (decoded.role === "user") {
      req.user = await User.findById(decoded.id).select("-password");
    } else if (decoded.role === "driver") {
      req.user = await Driver.findById(decoded.id).select("-password");
    } else if (decoded.role === "admin") {
      req.user = { role: "admin" };
    }

    if (!req.user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.userRole = decoded.role;

    if (req.userRole !== "admin") {
      if (decoded.tv !== undefined && decoded.tv !== req.user.tokenVersion) {
        return res.status(401).json({ message: "Session expired. Please log in again." });
      }
      if (req.userRole === "driver" && req.user.kycStatus === "approved" && !req.user.isActive) {
        return res.status(401).json({ message: "Your account has been deactivated" });
      }
      if (req.userRole === "user" && req.user.isActive === false) {
        return res.status(401).json({ message: "Your account has been deactivated" });
      }
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: "Not authorized, token invalid" });
  }
};

export const authorizeUser = (req: AuthRequest, res: Response, next: NextFunction): any => {
  if (req.userRole !== "user") {
    return res.status(403).json({ message: "Access denied. Users only." });
  }
  next();
};

export const authorizeAdmin = (req: AuthRequest, res: Response, next: NextFunction): any => {
  if (req.userRole !== "admin") {
    return res.status(403).json({ message: "Access denied. Admins only." });
  }
  next();
};

export const authorizeDriver = (req: AuthRequest, res: Response, next: NextFunction): any => {
  if (req.userRole !== "driver") {
    return res.status(403).json({ message: "Access denied. Drivers only." });
  }
  next();
};

export const authorizeUserOrDriver = (req: AuthRequest, res: Response, next: NextFunction): any => {
  if (req.userRole !== "user" && req.userRole !== "driver") {
    return res.status(403).json({ message: "Access denied." });
  }
  next();
};