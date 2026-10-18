import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.JWT_SECRET || "mymate_default_csrf_secret_32bytes_long";

/**
 * Generates a signed CSRF token with random nonce and HMAC signature.
 */
export function generateCsrfToken(): string {
  const nonce = crypto.randomBytes(24).toString("hex");
  const signature = crypto
    .createHmac("sha256", CSRF_SECRET)
    .update(nonce)
    .digest("hex");
  return `${nonce}.${signature}`;
}

/**
 * Validates a signed CSRF token using timing-safe comparison.
 */
export function verifyCsrfToken(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [nonce, signature] = parts;
  const expectedSignature = crypto
    .createHmac("sha256", CSRF_SECRET)
    .update(nonce)
    .digest("hex");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);
  return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
}

/**
 * Double-submit cookie & signed token CSRF protection middleware.
 * Defends cookie-authenticated sessions against Cross-Site Request Forgery (CSRF).
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction): any => {
  // 1. Ensure client has a valid XSRF-TOKEN cookie available on every request
  const existingCookie = req.cookies?.["XSRF-TOKEN"];
  if (!existingCookie || !verifyCsrfToken(existingCookie)) {
    const newToken = generateCsrfToken();
    res.cookie("XSRF-TOKEN", newToken, {
      httpOnly: false, // Readable by client JS for double-submit header
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  // 2. Safe HTTP methods (GET, HEAD, OPTIONS) do not mutate server state
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // 3. Webhooks authenticate via their own HMAC signature (e.g. Razorpay webhook)
  if (req.originalUrl?.includes("/payments/webhook") || req.path?.includes("/payments/webhook")) {
    return next();
  }

  // 4. If request is NOT using cookie authentication (e.g. no session cookie),
  // ambient browser credentials cannot be forged; allow through.
  const hasCookieSession = Boolean(req.cookies?.token);
  if (!hasCookieSession) {
    return next();
  }

  // 5. For cookie-authenticated mutating requests, enforce double-submit validation
  const clientHeader = (
    req.headers["x-xsrf-token"] ||
    req.headers["x-csrf-token"]
  ) as string;

  if (!clientHeader) {
    return res.status(403).json({ message: "CSRF token missing in request headers" });
  }

  // Verify that the token in header is cryptographically valid
  if (!verifyCsrfToken(clientHeader)) {
    return res.status(403).json({ message: "Invalid CSRF token" });
  }

  // If XSRF-TOKEN cookie was submitted, ensure header matches the cookie (double submit)
  if (existingCookie) {
    const headerBuf = Buffer.from(clientHeader);
    const cookieBuf = Buffer.from(existingCookie);
    if (headerBuf.length !== cookieBuf.length || !crypto.timingSafeEqual(headerBuf, cookieBuf)) {
      return res.status(403).json({ message: "CSRF token mismatch between header and cookie" });
    }
  }

  next();
};
