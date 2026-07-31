import mongoose, { Document, Model } from "mongoose";

export interface IConversation extends Document {
  user: mongoose.Types.ObjectId;
  driver: mongoose.Types.ObjectId;
  lastMessage: string;
  lastMessageAt: Date;
  lastSenderModel: "User" | "Driver" | "";
}

const conversationSchema = new mongoose.Schema<IConversation>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true },
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now },
    lastSenderModel: { type: String, enum: ["User", "Driver", ""], default: "" },
  },
  { timestamps: true }
);

conversationSchema.index({ user: 1, driver: 1 }, { unique: true });

export default mongoose.model<IConversation>("Conversation", conversationSchema);
