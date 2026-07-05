import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true },
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now },
    lastSenderModel: { type: String, enum: ["User", "Driver"], default: "" },
  },
  { timestamps: true }
);

conversationSchema.index({ user: 1, driver: 1 }, { unique: true });

export default mongoose.model("Conversation", conversationSchema);
