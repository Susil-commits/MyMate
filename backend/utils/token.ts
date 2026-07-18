// @ts-nocheck
import jwt from "jsonwebtoken";

export function generateToken(account: any, role: string) {
  const payload =
    role === "admin"
      ? { role: "admin" }
      : { id: account._id, role, tv: account.tokenVersion ?? 0 };
  return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: "7d" });
}
