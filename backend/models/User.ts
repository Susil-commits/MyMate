import mongoose, { Document, Model } from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string; // Optional after toJSON
  avatar?: { url: string; publicId: string };
  gender: "male" | "female" | "other" | "";
  phone: string;
  locality: string;
  profileCompleted: boolean;
  isActive: boolean;
  tokenVersion: number;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpire?: Date;
  role: "user";
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  isTwoFactorEnabled: boolean;
  twoFactorSecret?: string;
  walletBalance: number;
  comparePassword(candidatePassword: string): Promise<boolean>;
  getResetPasswordToken(): string;
  toJSON(): any;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    name: { type: String, trim: true, default: "" },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    avatar: { url: { type: String, default: "" }, publicId: { type: String, default: "" } },
    gender: { type: String, enum: ["male", "female", "other", ""], default: "" },
    phone: { type: String, trim: true, default: "" },
    locality: { type: String, trim: true, default: "" },
    profileCompleted: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: String,
    emailVerificationExpire: Date,
    role: { type: String, default: "user", enum: ["user"] },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    isTwoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: "" },
    walletBalance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.getResetPasswordToken = function (): string {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  this.resetPasswordExpire = Date.now() + 3600000;
  return resetToken;
};

userSchema.methods.toJSON = function (): Partial<IUser> {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpire;
  delete obj.twoFactorSecret;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpire;
  return obj;
};

export default mongoose.model<IUser>("User", userSchema);