import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { HiClipboardList } from "react-icons/hi";
import BackButton from "../components/BackButton";
import ConfirmDialog from "../components/ConfirmDialog";
import api from "../api/axios";
import { bookingStatusColors } from "../utils/constants";
import toast from "react-hot-toast";

export default function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true);
      try {
        const params = statusFilter ? `?status=${statusFilter}` : "";
        const { data } = await api.get(`/bookings/user${params}`);
        setBookings(data.bookings);
      } catch (err) {
        console.error("Failed to load bookings:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, [statusFilter]);

  const handleConfirmCancel = async () => {
    if (!confirmCancel) return;
    setCancelling(true);
    try {
      await api.put(`/bookings/${confirmCancel}/status`, { status: "cancelled" });
      setBookings((prev) =>
        prev.map((b) => (b._id === confirmCancel ? { ...b, status: "cancelled" } : b))
      );
      toast.success("Booking cancelled");
      setConfirmCancel(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to cancel");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <BackButton to="/drivers" label="Back to Drivers" />
      <div className="flex items-center justify-between mb-6">
 <h1 className="text-3xl font-extrabold text-gray-900 ">
          My <span className="gradient-text">Bookings</span>
        </h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
 className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="ongoing">Ongoing</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
 <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="space-y-3">
                <div className="skeleton h-5 w-40 rounded" />
                <div className="skeleton h-4 w-60 rounded" />
                <div className="skeleton h-4 w-32 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 animate-fade-up">
 <HiClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
 <p className="text-gray-500 text-lg">No bookings found.</p>
 <Link to="/drivers" className="mt-2 inline-block text-blue-600 hover:text-blue-700 font-semibold text-sm">
            Find a driver
          </Link>
        </div>
      ) : (
        <div className="space-y-4 stagger-1">
          {bookings.map((booking) => (
 <div key={booking._id} className="bg-white rounded-2xl border border-gray-100 p-6 card-hover animate-scale-in">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {booking.driver?.name?.charAt(0)}
                  </div>
                  <div>
 <Link to={`/drivers/${booking.driver?._id}`} className="text-lg font-bold text-gray-900 hover:text-gray-700 transition-colors">
                      {booking.driver?.name}
                    </Link>
 <p className="text-sm text-gray-500 mt-0.5">
                      {booking.hireType === "temporary" ? "Temporary" : "Permanent"} &middot;{" "}
                      {new Date(booking.startDate).toLocaleDateString()}
                      {booking.endDate && ` → ${new Date(booking.endDate).toLocaleDateString()}`}
                    </p>
 <p className="text-sm text-gray-500 ">{booking.pickupLocation} {booking.dropLocation && `→ ${booking.dropLocation}`}</p>
 <p className="text-sm font-bold text-green-600 mt-1">${booking.totalAmount}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${bookingStatusColors[booking.status]}`}>
                    {booking.status}
                  </span>
                  {(booking.status === "pending" || booking.status === "accepted") && (
                    <button
                      onClick={() => setConfirmCancel(booking._id)}
 className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <Link
                    to={`/bookings/${booking._id}`}
 className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmCancel}
        title="Cancel Booking"
        message="Are you sure you want to cancel this booking? This action cannot be undone."
        confirmLabel="Yes, Cancel"
        variant="danger"
        loading={cancelling}
        onConfirm={handleConfirmCancel}
        onCancel={() => setConfirmCancel(null)}
      />
    </div>
  );
}
