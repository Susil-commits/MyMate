import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { HiBell } from "react-icons/hi";
import api from "../api/axios";

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const typeColors = {
  booking: "bg-blue-500",
  payment: "bg-green-500",
  kyc: "bg-purple-500",
  review: "bg-yellow-500",
  system: "bg-gray-500",
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const { data } = await api.get("/notifications?limit=5");
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      } catch {
        // silently fail
      }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await api.put("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // silently fail
    }
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <HiBell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-scale-in">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-scale-in z-50">
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-900 dark:text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <HiBell className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n._id}
                  to={n.link || "#"}
                  onClick={() => setOpen(false)}
                  className={`flex items-start gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-50 dark:border-gray-700/50 last:border-0 ${
                    !n.read ? "bg-blue-50/50 dark:bg-blue-900/20" : ""
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${typeColors[n.type] || "bg-gray-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.read ? "font-semibold text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"}`}>{n.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{n.message}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />}
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}