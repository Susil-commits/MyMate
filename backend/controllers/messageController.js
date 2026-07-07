import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { createNotification } from "../models/Notification.js";

const myModel = (role) => (role === "driver" ? "Driver" : "User");

function isMember(conv, role, userId) {
  if (!conv) return false;
  if (role === "user") return String(conv.user) === String(userId);
  if (role === "driver") return String(conv.driver) === String(userId);
  return false;
}

export const getOrCreateConversation = async (req, res) => {
  const { recipientId } = req.body;
  if (!recipientId) return res.status(400).json({ message: "Recipient is required" });

  const user = req.userRole === "user" ? req.user._id : recipientId;
  const driver = req.userRole === "driver" ? req.user._id : recipientId;

  let conv = await Conversation.findOne({ user, driver })
    .populate("user", "name avatar locality")
    .populate("driver", "name avatar locality");
  if (!conv) {
    conv = await Conversation.create({ user, driver });
    conv = await Conversation.findById(conv._id)
      .populate("user", "name avatar locality")
      .populate("driver", "name avatar locality");
  }
  res.json({ conversation: conv });
};

export const getConversations = async (req, res) => {
  const filter = req.userRole === "user" ? { user: req.user._id } : { driver: req.user._id };
  const conversations = await Conversation.find(filter)
    .populate("user", "name avatar locality")
    .populate("driver", "name avatar locality")
    .sort({ lastMessageAt: -1 });

  const me = myModel(req.userRole);
  const convIds = conversations.map((c) => c._id);
  const unreadAgg = convIds.length
    ? await Message.aggregate([
        { $match: { conversation: { $in: convIds }, senderModel: { $ne: me }, read: false } },
        { $group: { _id: "$conversation", count: { $sum: 1 } } },
      ])
    : [];
  const unreadMap = {};
  unreadAgg.forEach((r) => {
    unreadMap[String(r._id)] = r.count;
  });

  const result = conversations.map((c) => ({
    ...c.toObject(),
    unreadCount: unreadMap[String(c._id)] || 0,
  }));
  res.json({ conversations: result });
};

export const getMessages = async (req, res) => {
  const conv = await Conversation.findById(req.params.conversationId);
  if (!conv) return res.status(404).json({ message: "Conversation not found" });
  if (!isMember(conv, req.userRole, req.user._id)) {
    return res.status(403).json({ message: "Not authorized" });
  }

  const messages = await Message.find({ conversation: conv._id }).sort({ createdAt: 1 });

  // mark messages from the other party as read
  const me = myModel(req.userRole);
  await Message.updateMany(
    { conversation: conv._id, senderModel: { $ne: me }, read: false },
    { $set: { read: true } }
  );

  res.json({ messages });
};

export const sendMessage = async (req, res) => {
  const { conversationId, text } = req.body;
  if (!text || !String(text).trim()) {
    return res.status(400).json({ message: "Message cannot be empty" });
  }
  const conv = await Conversation.findById(conversationId);
  if (!conv) return res.status(404).json({ message: "Conversation not found" });
  if (!isMember(conv, req.userRole, req.user._id)) {
    return res.status(403).json({ message: "Not authorized" });
  }

  const me = myModel(req.userRole);
  const message = await Message.create({
    conversation: conv._id,
    sender: req.user._id,
    senderModel: me,
    text: String(text).trim(),
  });

  conv.lastMessage = message.text;
  conv.lastMessageAt = message.createdAt;
  conv.lastSenderModel = me;
  await conv.save();

  const recipientId = req.userRole === "user" ? conv.driver : conv.user;
  const recipientModel = req.userRole === "user" ? "Driver" : "User";
  createNotification({
    userId: recipientId,
    userModel: recipientModel,
    title: "New Message",
    message: message.text.slice(0, 80),
    type: "message",
    link: `/messages/${conv._id}`,
  }).catch(() => {});

  res.status(201).json({ message });
};

export const markConversationRead = async (req, res) => {
  const conv = await Conversation.findById(req.params.conversationId);
  if (!conv) return res.status(404).json({ message: "Conversation not found" });
  if (!isMember(conv, req.userRole, req.user._id)) {
    return res.status(403).json({ message: "Not authorized" });
  }
  const me = myModel(req.userRole);
  await Message.updateMany(
    { conversation: conv._id, senderModel: { $ne: me }, read: false },
    { $set: { read: true } }
  );
  res.json({ message: "Marked as read" });
};
