import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, refPath: "userModel", required: true },
    userModel: { type: String, required: true, enum: ["User", "Driver"] },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["booking", "payment", "kyc", "review", "system"],
      default: "system",
    },
    link: { type: String, default: "" },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export const createNotification = async ({ userId, userModel, title, message, type = "system", link = "" }) => {
  return Notification.create({ user: userId, userModel, title, message, type, link });
};

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;