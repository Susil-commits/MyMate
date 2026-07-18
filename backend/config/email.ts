// @ts-nocheck
import logger from "./logger.js";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendEmail = async ({ to, subject, html, text }: { to: string; subject: string; html?: string; text?: string }) => {
  try {
    const info = await transporter.sendMail({
      from: `"MyMate" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });
    logger.info(`Email sent: ${info.messageId}`);
  } catch (error) {
    logger.error("Error sending email", error);
  }
};

export const sendBookingConfirmation = async (user: any, driver: any, booking: any) => {
  await sendEmail({
    to: user.email,
    subject: "Booking Confirmed - MyMate",
    html: `<p>Hi ${user.name}, your booking (ID: ${booking._id}) with ${driver.name} has been confirmed.</p>`,
  });
};

export const sendBookingStatusUpdate = async (user: any, driver: any, booking: any, status: string) => {
  await sendEmail({
    to: user.email,
    subject: `Booking Status Update - ${status}`,
    html: `<p>Hi ${user.name}, the status of your booking (ID: ${booking._id}) has been updated to: <strong>${status}</strong>.</p>`,
  });
};

export const sendPasswordResetEmail = async (email: string, resetToken?: string) => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
  await sendEmail({
    to: email,
    subject: "Password Reset - MyMate",
    html: `<p>You requested a password reset. Please click <a href="${resetUrl}">here</a> to reset your password. If you didn't request this, ignore this email.</p>`,
  });
};

export const sendKycStatusEmail = async (driver: any, status: string) => {
  await sendEmail({
    to: driver.email,
    subject: `KYC Status Update - ${status}`,
    html: `<p>Hi ${driver.name}, your KYC verification status is now: <strong>${status}</strong>.</p>`,
  });
};

export const sendVerificationEmail = async (email: string, token?: string) => {
  const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${token}`;
  await sendEmail({
    to: email,
    subject: "Verify your Email - MyMate",
    html: `<p>Please click <a href="${verifyUrl}">here</a> to verify your email address.</p>`,
  });
};
