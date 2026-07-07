import jwt from "jsonwebtoken";

export function generateToken(account, role) {
  const payload =
    role === "admin"
      ? { role: "admin" }
      : { id: account._id, role, tv: account.tokenVersion ?? 0 };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}
