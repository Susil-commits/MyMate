import logger from "./logger.js";

// Email sending is intentionally disabled for now.
// SMTP will be re-enabled later. All functions are no-ops so the
// auth/booking/kyc workflows continue to run without an email server.
// To restore: import nodemailer, create a transporter, and send here.

const skip = (label, meta) => logger.info(`[email disabled] ${label}`, meta);

export const sendEmail = async ({ to, subject } = {}) => {
  skip("sendEmail", { to, subject });
};

export const sendBookingConfirmation = async (user, driver, booking) => {
  skip("sendBookingConfirmation", { bookingId: booking?._id });
};

export const sendBookingStatusUpdate = async (user, driver, booking, status) => {
  skip("sendBookingStatusUpdate", { bookingId: booking?._id, status });
};

export const sendPasswordResetEmail = async (email) => {
  skip("sendPasswordResetEmail", { to: email });
};

export const sendKycStatusEmail = async (driver, status) => {
  skip("sendKycStatusEmail", { driverId: driver?._id, status });
};

export const sendVerificationEmail = async (email) => {
  skip("sendVerificationEmail", { to: email });
};
