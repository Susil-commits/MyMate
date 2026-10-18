import { z } from "zod";
import { Request, Response, NextFunction } from "express";

export const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.issues[0]?.message || "Validation failed" });
      }
      next(error);
    }
  };
};

export const userRegisterSchema = z.object({
  email: z.string().email("Valid email is required").transform(e => e.toLowerCase()),
  password: z.string().min(6, "Password must be at least 6 characters"),
  gender: z.enum(["male", "female", "other"], { message: "Gender is required" }),
  phone: z.string().trim().min(1, "Phone number is required"),
});
export type UserRegisterInput = z.infer<typeof userRegisterSchema>;
export const userRegisterValidator = [validateRequest(userRegisterSchema)];

export const userLoginSchema = z.object({
  email: z.string().email("Valid email is required").transform(e => e.toLowerCase()),
  password: z.string().min(1, "Password is required"),
});
export type UserLoginInput = z.infer<typeof userLoginSchema>;
export const userLoginValidator = [validateRequest(userLoginSchema)];

export const driverRegisterSchema = z.object({
  email: z.string().email("Valid email is required").transform(e => e.toLowerCase()),
  password: z.string().min(6, "Password must be at least 6 characters"),
  gender: z.enum(["male", "female", "other"], { message: "Gender is required" }),
  phone: z.string().trim().min(1, "Phone number is required"),
});
export type DriverRegisterInput = z.infer<typeof driverRegisterSchema>;
export const driverRegisterValidator = [validateRequest(driverRegisterSchema)];

export const driverLoginSchema = z.object({
  email: z.string().email("Valid email is required").transform(e => e.toLowerCase()),
  password: z.string().min(1, "Password is required"),
});
export type DriverLoginInput = z.infer<typeof driverLoginSchema>;
export const driverLoginValidator = [validateRequest(driverLoginSchema)];

export const adminLoginSchema = z.object({
  email: z.string().email("Valid email is required").transform(e => e.toLowerCase()).optional(),
  password: z.string().min(1, "Password is required").optional(),
  code: z.string().trim().optional(),
}).refine(data => (data.email && data.password) || data.code, {
  message: "Either email and password or admin code is required",
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export const adminLoginValidator = [validateRequest(adminLoginSchema)];

export const completeUserProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  locality: z.string().trim().min(1, "Locality is required"),
});
export type CompleteUserProfileInput = z.infer<typeof completeUserProfileSchema>;
export const completeUserProfileValidator = [validateRequest(completeUserProfileSchema)];

export const completeDriverProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").optional(),
  nationality: z.string().trim().min(1, "Nationality is required").optional(),
  locality: z.string().trim().min(1, "Locality is required").optional(),
  licenseNumber: z.string().trim().min(1, "License number is required").optional(),
  experienceYears: z.coerce.number().min(0, "Experience years required").optional(),
  hourlyRate: z.coerce.number().min(1, "Hourly rate required").optional(),
  dailyRate: z.coerce.number().min(1, "Daily rate required").optional(),
  languages: z.string().optional(),
  bio: z.string().optional(),
  vehicleTypes: z.union([z.string(), z.array(z.string())]).transform((val) => Array.isArray(val) ? val : [val])
    .refine((val) => val.length > 0, "At least one vehicle type is required").optional(),
});
export type CompleteDriverProfileInput = z.infer<typeof completeDriverProfileSchema>;
export const completeDriverProfileValidator = [validateRequest(completeDriverProfileSchema)];

export const bookingSchema = z.object({
  driverId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Valid driver ID is required"),
  hireType: z.enum(["temporary", "permanent"], { message: "Hire type must be temporary or permanent" }),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Valid start date is required").refine((val) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return new Date(val) >= today;
  }, "Start date cannot be in the past"),
  endDate: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), "Valid end date is required"),
  pickupLocation: z.string().trim().min(1, "Pickup location is required"),
  dropLocation: z.string().trim().optional(),
  purpose: z.string().trim().min(1, "Purpose is required"),
  promoCode: z.string().trim().optional(),
  stops: z.array(z.any()).optional(),
  isRecurring: z.boolean().optional(),
  recurringPattern: z.string().optional(),
  recurringEndDate: z.string().optional(),
}).refine((data) => {
  if (data.endDate && data.startDate) {
    return new Date(data.endDate) >= new Date(data.startDate);
  }
  return true;
}, {
  message: "End date cannot be before start date",
  path: ["endDate"],
});
export type BookingInput = z.infer<typeof bookingSchema>;
export const bookingValidator = [validateRequest(bookingSchema)];

export const updateBookingStatusSchema = z.object({
  status: z.enum(["pending", "accepted", "ongoing", "completed", "cancelled", "rejected"]),
});
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;

export const reviewSchema = z.object({
  bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Valid booking ID is required"),
  driverId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Valid driver ID is required"),
  rating: z.coerce.number().min(1, "Rating must be between 1 and 5").max(5, "Rating must be between 1 and 5"),
  comment: z.string().trim().max(1000).optional().or(z.literal('')),
});
export type ReviewInput = z.infer<typeof reviewSchema>;
export const reviewValidator = [validateRequest(reviewSchema)];

export const forgotPasswordSchema = z.object({
  email: z.string().email("Valid email is required").transform(e => e.toLowerCase()),
  role: z.enum(["user", "driver"], { message: "Role must be user or driver" }),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export const forgotPasswordValidator = [validateRequest(forgotPasswordSchema)];

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export const changePasswordValidator = [validateRequest(changePasswordSchema)];

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["user", "driver"], { message: "Role must be user or driver" }),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export const resetPasswordValidator = [validateRequest(resetPasswordSchema)];

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
  role: z.enum(["user", "driver"], { message: "Role must be user or driver" }),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: z.string().email("Valid email is required").transform(e => e.toLowerCase()),
  role: z.enum(["user", "driver"], { message: "Role must be user or driver" }),
});
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const createPaymentOrderSchema = z.object({
  bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Valid booking ID is required"),
});
export type CreatePaymentOrderInput = z.infer<typeof createPaymentOrderSchema>;

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1, "razorpay_order_id is required"),
  razorpay_payment_id: z.string().min(1, "razorpay_payment_id is required"),
  razorpay_signature: z.string().min(1, "razorpay_signature is required"),
});
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

export const refundPaymentSchema = z.object({
  bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Valid booking ID is required"),
});
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;

export const payWithWalletSchema = z.object({
  bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Valid booking ID is required"),
});
export type PayWithWalletInput = z.infer<typeof payWithWalletSchema>;