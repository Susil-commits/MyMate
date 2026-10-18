import mongoose, { Document } from "mongoose";
import bcrypt from "bcryptjs";

export interface IAdmin extends Document {
  email: string;
  password?: string;
  role: "admin";
  lastLoginAt?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  toJSON(): any;
}

const adminSchema = new mongoose.Schema<IAdmin>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, default: "admin", enum: ["admin"] },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

adminSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

adminSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

adminSchema.methods.toJSON = function (): Partial<IAdmin> {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export default mongoose.model<IAdmin>("Admin", adminSchema);
