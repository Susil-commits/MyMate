import { body } from "express-validator";

export const userRegisterValidator = [
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("gender").isIn(["male", "female", "other"]).withMessage("Gender is required"),
  body("phone").trim().notEmpty().withMessage("Phone number is required"),
];

export const userLoginValidator = [
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

export const driverRegisterValidator = [
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("gender").isIn(["male", "female", "other"]).withMessage("Gender is required"),
  body("phone").trim().notEmpty().withMessage("Phone number is required"),
];

export const driverLoginValidator = [
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

export const adminLoginValidator = [
  body("code").trim().notEmpty().withMessage("Admin code is required"),
];

export const completeUserProfileValidator = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("locality").trim().notEmpty().withMessage("Locality is required"),
];

export const completeDriverProfileValidator = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("nationality").trim().notEmpty().withMessage("Nationality is required"),
  body("locality").trim().notEmpty().withMessage("Locality is required"),
  body("licenseNumber").trim().notEmpty().withMessage("License number is required"),
  body("experienceYears").isInt({ min: 0 }).withMessage("Experience years required"),
  body("hourlyRate").isFloat({ min: 1 }).withMessage("Hourly rate required"),
  body("dailyRate").isFloat({ min: 1 }).withMessage("Daily rate required"),
];

export const bookingValidator = [
  body("driverId").isMongoId().withMessage("Valid driver ID is required"),
  body("hireType").isIn(["temporary", "permanent"]).withMessage("Hire type must be temporary or permanent"),
  body("startDate").isISO8601().withMessage("Valid start date is required"),
  body("startDate")
    .custom((value) => {
      if (new Date(value) < new Date(new Date().setHours(0, 0, 0, 0))) {
        throw new Error("Start date cannot be in the past");
      }
      return true;
    }),
  body("endDate").optional().isISO8601().withMessage("Valid end date is required"),
  body("endDate")
    .optional()
    .custom((value, { req }) => {
      if (value && new Date(value) < new Date(req.body.startDate)) {
        throw new Error("End date cannot be before start date");
      }
      return true;
    }),
  body("pickupLocation").trim().notEmpty().withMessage("Pickup location is required"),
  body("purpose").trim().notEmpty().withMessage("Purpose is required"),
];

export const reviewValidator = [
  body("bookingId").isMongoId().withMessage("Valid booking ID is required"),
  body("driverId").isMongoId().withMessage("Valid driver ID is required"),
  body("rating").isInt({ min: 1, max: 5 }).withMessage("Rating must be between 1 and 5"),
  body("comment").optional().trim().isLength({ max: 1000 }),
];

export const forgotPasswordValidator = [
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("role").isIn(["user", "driver"]).withMessage("Role must be user or driver"),
];

export const changePasswordValidator = [
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  body("newPassword").isLength({ min: 6 }).withMessage("New password must be at least 6 characters"),
];

export const resetPasswordValidator = [
  body("token").notEmpty().withMessage("Reset token is required"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("role").isIn(["user", "driver"]).withMessage("Role must be user or driver"),
];