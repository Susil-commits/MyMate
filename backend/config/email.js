import nodemailer from "nodemailer";
import logger from "./logger.js";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.verify().then(() => {
  logger.info("Email service ready");
}).catch((err) => {
  logger.warn("Email service not configured", { error: err.message });
});

export const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.SMTP_USER) {
    logger.info("Email skipped (SMTP not configured)", { to, subject });
    return;
  }

  try {
    await transporter.sendMail({
      from: `"MyMate" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    logger.info("Email sent", { to, subject });
  } catch (error) {
    logger.error("Email send failed", { to, subject, error: error.message });
  }
};

export const sendBookingConfirmation = async (user, driver, booking) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Booking Request Sent</h2>
      <p>Hi ${user.name},</p>
      <p>Your booking request has been sent to <strong>${driver.name}</strong>.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Booking ID</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${booking._id}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Driver</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${driver.name}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Hire Type</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${booking.hireType}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Amount</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">₹${booking.totalAmount}</td></tr>
      </table>
      <p>You'll be notified when the driver responds.</p>
    </div>
  `;
  await sendEmail({ to: user.email, subject: "Booking Request Sent - MyMate", html });
};

export const sendBookingStatusUpdate = async (user, driver, booking, status) => {
  const statusMessages = {
    accepted: "Your booking has been accepted!",
    rejected: "Your booking was declined.",
    ongoing: "Your trip has started.",
    completed: "Your trip is complete. Please leave a review!",
    cancelled: "Your booking has been cancelled.",
  };

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Booking Update</h2>
      <p>Hi ${user.name},</p>
      <p>${statusMessages[status] || "Your booking status has been updated."}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Driver</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${driver.name}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Status</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${status.charAt(0).toUpperCase() + status.slice(1)}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Amount</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">₹${booking.totalAmount}</td></tr>
      </table>
      ${status === "completed" ? '<p><a href="' + process.env.CLIENT_URL + '/bookings" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px;">Leave a Review</a></p>' : ""}
    </div>
  `;
  await sendEmail({ to: user.email, subject: `Booking ${status.charAt(0).toUpperCase() + status.slice(1)} - MyMate`, html });
};

export const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Password Reset</h2>
      <p>You requested a password reset for your MyMate account.</p>
      <p>Click the button below to reset your password. This link expires in 1 hour.</p>
      <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">Reset Password</a>
      <p style="color: #666; font-size: 12px;">If you didn't request this, please ignore this email.</p>
    </div>
  `;
  await sendEmail({ to: email, subject: "Password Reset - MyMate", html });
};

export const sendKycStatusEmail = async (driver, status) => {
  const statusMessages = {
    approved: "Your KYC verification has been approved! You're now live on the platform.",
    rejected: "Your KYC verification was rejected. Please update your documents and resubmit.",
  };

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">KYC Verification Update</h2>
      <p>Hi ${driver.name},</p>
      <p>${statusMessages[status] || "Your KYC status has been updated."}</p>
      <p>Status: <strong>${status.charAt(0).toUpperCase() + status.slice(1)}</strong></p>
      ${status === "rejected" ? '<p><a href="' + process.env.CLIENT_URL + '/driver/profile" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Update Documents</a></p>' : ""}
    </div>
  `;
  await sendEmail({ to: driver.email, subject: `KYC ${status.charAt(0).toUpperCase() + status.slice(1)} - MyMate`, html });
};

export const sendVerificationEmail = async (email, token, role) => {
  const verifyUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}&role=${role}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Verify Your Email</h2>
      <p>Welcome to MyMate! Please verify your email address to activate your account.</p>
      <a href="${verifyUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">Verify Email</a>
      <p style="color: #666; font-size: 12px;">This link expires in 24 hours. If you didn't create an account, please ignore this email.</p>
    </div>
  `;
  await sendEmail({ to: email, subject: "Verify Your Email - MyMate", html });
};