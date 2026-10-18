import jwt from "jsonwebtoken";

export const TOKEN_EXPIRES_IN = "7d";
export const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export function generateToken(account: any, role: string) {
  const payload =
    role === "admin"
      ? { role: "admin", id: account?._id }
      : { id: account._id, role, tv: account.tokenVersion ?? 0 };
  return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: TOKEN_EXPIRES_IN });
}
