import Notification from "../models/Notification.js";

const ownerQuery = (req, extra = {}) => ({
  user: req.user._id,
  userModel: req.userRole === "driver" ? "Driver" : "User",
  ...extra,
});

export const getNotifications = async (req, res, next) => {
  try {
    const { unread, page = 1, limit = 20 } = req.query;
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const query = ownerQuery(req);
    if (unread === "true") query.read = false;

    const skip = (Number(page) - 1) * safeLimit;
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(safeLimit),
      Notification.countDocuments(query),
      Notification.countDocuments({ ...query, read: false }),
    ]);

    res.json({ notifications, unreadCount, pagination: { page: Number(page), pages: Math.ceil(total / safeLimit), total } });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(ownerQuery(req, { read: false }), { read: true });
    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    next(error);
  }
};

export const markOneAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      ownerQuery(req, { _id: req.params.id, read: false }),
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    res.json({ notification });
  } catch (error) {
    next(error);
  }
};