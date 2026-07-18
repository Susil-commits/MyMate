// @ts-nocheck
import Notification from "../models/Notification.js";

const myModel = (role) => (role === "driver" ? "Driver" : "User");

export const getNotifications = async (req, res) => {
  if (req.userRole === "admin") {
    return res.json({ notifications: [], unreadCount: 0 });
  }
  const me = myModel(req.userRole);
  const filter = { user: req.user._id, userModel: me };
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const [notifications, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(limit),
    Notification.countDocuments({ ...filter, read: false }),
  ]);
  res.json({ notifications, unreadCount });
};

export const markAsRead = async (req, res) => {
  if (req.userRole === "admin") return res.json({ message: "No notifications" });
  const me = myModel(req.userRole);
  await Notification.updateMany(
    { user: req.user._id, userModel: me, read: false },
    { $set: { read: true } }
  );
  res.json({ message: "All notifications marked as read" });
};

export const markOneAsRead = async (req, res) => {
  if (req.userRole === "admin") return res.json({ message: "No notifications" });
  const me = myModel(req.userRole);
  await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id, userModel: me },
    { $set: { read: true } }
  );
  res.json({ message: "Notification marked as read" });
};
