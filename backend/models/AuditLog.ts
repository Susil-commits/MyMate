import mongoose, { Document, Schema } from "mongoose";

export interface IAuditLog extends Document {
  user?: mongoose.Types.ObjectId;
  userType: "Admin" | "User" | "Driver" | "System";
  action: string;
  details: any;
  ipAddress: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    user: { type: Schema.Types.ObjectId, refPath: "userType" },
    userType: { type: String, required: true, enum: ["Admin", "User", "Driver", "System"] },
    action: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
