import Notification from "../models/Notification.js";

export const getNotifications = async (req, res, next) => {
  try {
    const { unread, page = 1, limit = 20 } = req.query;
    const query = { user: req.user._id, userModel: req.userRole === "driver" ? "Driver" : "User" };
    if (unread === "true") query.read = false;

    const skip = (Number(page) - 1) * Number(limit);
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Notification.countDocuments(query),
      Notification.countDocuments({ ...query, read: false }),
    ]);

    res.json({ notifications, unreadCount, pagination: { page: Number(page), pages: Math.ceil(total / Number(limit)), total } });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, userModel: req.userRole === "driver" ? "Driver" : "User", read: false },
      { read: true }
    );
    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    next(error);
  }
};

export const markOneAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    res.json({ notification });
  } catch (error) {
    next(error);
  }
};