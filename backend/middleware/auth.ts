import jwt from "jsonwebtoken";
import User, { IUser } from "../models/User.js";
import Driver, { IDriver } from "../models/Driver.js";
import { Request, Response, NextFunction } from "express";

export interface AdminUser {
  role: "admin";
}

export type AuthenticatedPrincipal =
  | (IUser & { role: "user" })
  | (IDriver & { role: "driver" })
  | AdminUser;

export type AuthUser = AuthenticatedPrincipal;

export interface AuthRequest extends Request {
  user?: AuthenticatedPrincipal;
  userRole?: string;
  cookies: Record<string, any>;
}

export const verifyAndResolveUser = async (
  token?: string
): Promise<{ user: AuthUser | null; userRole: "user" | "driver" | "admin" | null; error?: string }> => {
  if (!token) {
    return { user: null, userRole: null, error: "Not authorized, no token" };
  }
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);
    let user: AuthUser | null = null;

    if (decoded.role === "user") {
      const userDoc = await User.findById(decoded.id).select("-password");
      if (userDoc) user = userDoc;
    } else if (decoded.role === "driver") {
      const driverDoc = await Driver.findById(decoded.id).select("-password");
      if (driverDoc) user = driverDoc;
    } else if (decoded.role === "admin") {
      user = { role: "admin" };
    }

    if (!user) {
      return { user: null, userRole: null, error: "User not found" };
    }

    if (decoded.role !== "admin") {
      const userOrDriver = user as IUser | IDriver;
      if (decoded.tv !== undefined && decoded.tv !== userOrDriver.tokenVersion) {
        return { user: null, userRole: null, error: "Session expired. Please log in again." };
      }
      if (decoded.role === "driver") {
        const driver = user as IDriver;
        if (driver.kycStatus === "approved" && !driver.isActive) {
          return { user: null, userRole: null, error: "Your account has been deactivated" };
        }
      }
      if (decoded.role === "user") {
        const u = user as IUser;
        if (u.isActive === false) {
          return { user: null, userRole: null, error: "Your account has been deactivated" };
        }
      }
    }

    return { user, userRole: decoded.role };
  } catch {
    return { user: null, userRole: null, error: "Not authorized, token invalid" };
  }
};

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<any> => {
  let token = req.cookies?.token;
  
  if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  const { user, userRole, error } = await verifyAndResolveUser(token);
  if (error || !user) {
    return res.status(401).json({ message: error || "Not authorized" });
  }

  req.user = user;
  req.userRole = userRole || undefined;
  next();
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

export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    let token = req.cookies?.token;
    
    if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next();
    }
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);

    if (decoded.role === "user") {
      const userDoc = await User.findById(decoded.id).select("-password");
      if (userDoc) req.user = userDoc;
    } else if (decoded.role === "driver") {
      const driverDoc = await Driver.findById(decoded.id).select("-password");
      if (driverDoc) req.user = driverDoc;
    } else if (decoded.role === "admin") {
      req.user = { role: "admin" };
    }

    if (req.user) {
      req.userRole = decoded.role;
    }

    next();
  } catch (error) {
    next();
  }
};