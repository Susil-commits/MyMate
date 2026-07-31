import mongoose, { Document, Model } from "mongoose";

export interface INotification extends Document {
  user: mongoose.Types.ObjectId;
  userModel: "User" | "Driver";
  title: string;
  message: string;
  type: "booking" | "payment" | "kyc" | "review" | "message" | "system";
  link: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new mongoose.Schema<INotification>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, refPath: "userModel", required: true },
    userModel: { type: String, required: true, enum: ["User", "Driver"] },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["booking", "payment", "kyc", "review", "message", "system"],
      default: "system",
    },
    link: { type: String, default: "" },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export const createNotification = async ({
  userId,
  userModel,
  title,
  message,
  type = "system",
  link = "",
}: {
  userId: string | mongoose.Types.ObjectId;
  userModel: "User" | "Driver";
  title: string;
  message: string;
  type?: INotification["type"];
  link?: string;
}) => {
  return Notification.create({ user: userId, userModel, title, message, type, link });
};

const Notification = mongoose.model<INotification>("Notification", notificationSchema);
export default Notification;