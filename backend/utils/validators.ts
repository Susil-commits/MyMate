// @ts-nocheck
import { z } from "zod";
import { Request, Response, NextFunction } from "express";

export const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      next(error);
    }
  };
};

const userRegisterSchema = z.object({
  email: z.string().email("Valid email is required").transform(e => e.toLowerCase()),
  password: z.string().min(6, "Password must be at least 6 characters"),
  gender: z.enum(["male", "female", "other"], { required_error: "Gender is required" }),
  phone: z.string().trim().min(1, "Phone number is required"),
});
export const userRegisterValidator = [validateRequest(userRegisterSchema)];

const userLoginSchema = z.object({
  email: z.string().email("Valid email is required").transform(e => e.toLowerCase()),
  password: z.string().min(1, "Password is required"),
});
export const userLoginValidator = [validateRequest(userLoginSchema)];

const driverRegisterSchema = z.object({
  email: z.string().email("Valid email is required").transform(e => e.toLowerCase()),
  password: z.string().min(6, "Password must be at least 6 characters"),
  gender: z.enum(["male", "female", "other"], { required_error: "Gender is required" }),
  phone: z.string().trim().min(1, "Phone number is required"),
});
export const driverRegisterValidator = [validateRequest(driverRegisterSchema)];

const driverLoginSchema = z.object({
  email: z.string().email("Valid email is required").transform(e => e.toLowerCase()),
  password: z.string().min(1, "Password is required"),
});
export const driverLoginValidator = [validateRequest(driverLoginSchema)];

const adminLoginSchema = z.object({
  code: z.string().trim().min(1, "Admin code is required"),
});
export const adminLoginValidator = [validateRequest(adminLoginSchema)];

const completeUserProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  locality: z.string().trim().min(1, "Locality is required"),
});
export const completeUserProfileValidator = [validateRequest(completeUserProfileSchema)];

const completeDriverProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  nationality: z.string().trim().min(1, "Nationality is required"),
  locality: z.string().trim().min(1, "Locality is required"),
  licenseNumber: z.string().trim().min(1, "License number is required"),
  experienceYears: z.coerce.number().min(0, "Experience years required"),
  hourlyRate: z.coerce.number().min(1, "Hourly rate required"),
  dailyRate: z.coerce.number().min(1, "Daily rate required"),
  vehicleTypes: z.union([z.string(), z.array(z.string())]).transform((val) => Array.isArray(val) ? val : [val])
    .refine((val) => val.length > 0, "At least one vehicle type is required"),
});
export const completeDriverProfileValidator = [validateRequest(completeDriverProfileSchema)];

const bookingSchema = z.object({
  driverId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Valid driver ID is required"),
  hireType: z.enum(["temporary", "permanent"], { required_error: "Hire type must be temporary or permanent" }),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Valid start date is required").refine((val) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return new Date(val) >= today;
  }, "Start date cannot be in the past"),
  endDate: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), "Valid end date is required"),
  pickupLocation: z.string().trim().min(1, "Pickup location is required"),
  purpose: z.string().trim().min(1, "Purpose is required"),
}).refine((data) => {
  if (data.endDate && data.startDate) {
    return new Date(data.endDate) >= new Date(data.startDate);
  }
  return true;
}, {
  message: "End date cannot be before start date",
  path: ["endDate"],
});
export const bookingValidator = [validateRequest(bookingSchema)];

const reviewSchema = z.object({
  bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Valid booking ID is required"),
  driverId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Valid driver ID is required"),
  rating: z.coerce.number().min(1, "Rating must be between 1 and 5").max(5, "Rating must be between 1 and 5"),
  comment: z.string().trim().max(1000).optional().or(z.literal('')),
});
export const reviewValidator = [validateRequest(reviewSchema)];

const forgotPasswordSchema = z.object({
  email: z.string().email("Valid email is required").transform(e => e.toLowerCase()),
  role: z.enum(["user", "driver"], { required_error: "Role must be user or driver" }),
});
export const forgotPasswordValidator = [validateRequest(forgotPasswordSchema)];

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});
export const changePasswordValidator = [validateRequest(changePasswordSchema)];

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["user", "driver"], { required_error: "Role must be user or driver" }),
});
export const resetPasswordValidator = [validateRequest(resetPasswordSchema)];