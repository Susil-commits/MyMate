import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import Driver from "../models/Driver.js";
import { createNotification } from "../models/Notification.js";

const myModel = (role) => (role === "user" ? "User" : "Driver");

const buildQuery = (req) =>
  req.userRole === "user" ? { user: req.user._id } : { driver: req.user._id };

export const getOrCreateConversation = async (req, res, next) => {
  try {
    const { recipientId } = req.body;
    if (!recipientId) {
      return res.status(400).json({ message: "Recipient ID is required" });
    }

    let user, driver;
    if (req.userRole === "user") {
      user = req.user._id;
      driver = recipientId;
      const exists = await Driver.findById(driver);
      if (!exists) return res.status(404).json({ message: "Driver not found" });
    } else {
      driver = req.user._id;
      user = recipientId;
      const exists = await User.findById(user);
      if (!exists) return res.status(404).json({ message: "User not found" });
    }

    let conversation = await Conversation.findOne({ user, driver });
    if (!conversation) {
      conversation = await Conversation.create({ user, driver });
    }

    res.json({ conversation });
  } catch (error) {
    next(error);
  }
};

export const getConversations = async (req, res, next) => {
  try {
    const conversations = await Conversation.find(buildQuery(req))
      .populate("user", "name")
      .populate("driver", "name locality averageRating")
      .sort({ lastMessageAt: -1 });

    const convIds = conversations.map((c) => c._id);
    const unreadAgg = await Message.aggregate([
      {
        $match: {
          conversation: { $in: convIds },
          read: false,
          senderModel: { $ne: myModel(req.userRole) },
        },
      },
      { $group: { _id: "$conversation", count: { $sum: 1 } } },
    ]);
    const unreadMap = {};
    unreadAgg.forEach((a) => (unreadMap[a._id.toString()] = a.count));

    res.json({
      conversations: conversations.map((c) => ({
        ...c.toObject(),
        unreadCount: unreadMap[c._id.toString()] || 0,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const getMessages = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    const ownerId = req.userRole === "user" ? conversation.user : conversation.driver;
    if (ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const messages = await Message.find({ conversation: conversation._id })
      .populate("sender", "name")
      .sort({ createdAt: 1 });

    await Message.updateMany(
      { conversation: conversation._id, read: false, senderModel: { $ne: myModel(req.userRole) } },
      { read: true }
    );

    res.json({ conversation, messages });
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const { conversationId, text } = req.body;
    if (!conversationId || !text || !text.trim()) {
      return res.status(400).json({ message: "Conversation ID and text are required" });
    }
    if (text.length > 2000) {
      return res.status(400).json({ message: "Message is too long (max 2000 characters)" });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    const ownerId = req.userRole === "user" ? conversation.user : conversation.driver;
    if (ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      senderModel: myModel(req.userRole),
      text: text.trim(),
    });

    conversation.lastMessage = message.text;
    conversation.lastMessageAt = message.createdAt;
    conversation.lastSenderModel = message.senderModel;
    await conversation.save();

    const recipientId = req.userRole === "user" ? conversation.driver : conversation.user;
    const recipientModel = req.userRole === "user" ? "Driver" : "User";
    createNotification({
      userId: recipientId,
      userModel: recipientModel,
      title: "New Message",
      message: `${message.text.slice(0, 60)}${message.text.length > 60 ? "..." : ""}`,
      type: "message",
      link: `/messages/${conversation._id}`,
    }).catch(() => {});

    await message.populate("sender", "name");

    res.status(201).json({ message });
  } catch (error) {
    next(error);
  }
};

export const markConversationRead = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    const ownerId = req.userRole === "user" ? conversation.user : conversation.driver;
    if (ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await Message.updateMany(
      { conversation: conversation._id, read: false, senderModel: { $ne: myModel(req.userRole) } },
      { read: true }
    );

    res.json({ message: "Marked as read" });
  } catch (error) {
    next(error);
  }
};
