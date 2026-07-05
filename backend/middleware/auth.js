import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Driver from "../models/Driver.js";

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

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

    if (req.userRole === "driver" && req.user.kycStatus === "approved" && !req.user.isActive) {
      return res.status(401).json({ message: "Your account has been deactivated" });
    }

    req.userRole = decoded.role;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Not authorized, token invalid" });
  }
};

export const authorizeUser = (req, res, next) => {
  if (req.userRole !== "user") {
    return res.status(403).json({ message: "Access denied. Users only." });
  }
  next();
};

export const authorizeAdmin = (req, res, next) => {
  if (req.userRole !== "admin") {
    return res.status(403).json({ message: "Access denied. Admins only." });
  }
  next();
};

export const authorizeDriver = (req, res, next) => {
  if (req.userRole !== "driver") {
    return res.status(403).json({ message: "Access denied. Drivers only." });
  }
  next();
};