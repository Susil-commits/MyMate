import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { HiClipboardList } from "react-icons/hi";
import BackButton from "../components/BackButton";
import api from "../api/axios";
import { bookingStatusColors } from "../utils/constants";
import toast from "react-hot-toast";

export default function DriverBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true);
      try {
        const params = statusFilter ? `?status=${statusFilter}` : "";
        const { data } = await api.get(`/bookings/driver${params}`);
        setBookings(data.bookings);
      } catch (err) {
        console.error("Failed to load bookings:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, [statusFilter]);

  const handleAction = async (bookingId, status) => {
    try {
      const { data } = await api.put(`/bookings/${bookingId}/status`, { status });
      setBookings((prev) => prev.map((b) => (b._id === bookingId ? data.booking : b)));
      toast.success(`Booking ${status}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update");
    }
  };

  return (
    <div className="animate-fade-in">
      <BackButton to="/driver/dashboard" label="Back to Dashboard" />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-extrabold text-gray-900">
          Booking <span className="gradient-text">Requests</span>
        </h1>
 <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200">
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="ongoing">Ongoing</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="rejected">Rejected</option>
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
          <p className="text-gray-500 text-lg">No booking requests yet.</p>
        </div>
      ) : (
        <div className="space-y-4 stagger-1">
          {bookings.map((booking) => (
            <div key={booking._id} className="bg-white rounded-2xl border border-gray-100 p-6 card-hover animate-scale-in">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg">
                    {booking.user?.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900">{booking.user?.name}</p>
                    <p className="text-sm text-gray-500">{booking.user?.phone}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {booking.hireType === "temporary" ? "Temporary" : "Permanent"} &middot;{" "}
                      {new Date(booking.startDate).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-500">{booking.pickupLocation}</p>
                    <p className="text-sm text-gray-500">{booking.purpose}</p>
                    <p className="text-sm font-bold text-green-600 mt-1">${booking.totalAmount}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${bookingStatusColors[booking.status]}`}>
                    {booking.status}
                  </span>
                  <div className="flex gap-2 mt-2">
                    {booking.status === "pending" && (
                      <>
                        <button onClick={() => handleAction(booking._id, "accepted")} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-all duration-200">
                          Accept
                        </button>
                        <button onClick={() => handleAction(booking._id, "rejected")} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition-all duration-200">
                          Reject
                        </button>
                      </>
                    )}
                    {booking.status === "accepted" && (
                      <button onClick={() => handleAction(booking._id, "ongoing")} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all duration-200">
                        Start Trip
                      </button>
                    )}
                    {booking.status === "ongoing" && (
                      <button onClick={() => handleAction(booking._id, "completed")} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-all duration-200">
                        Complete
                      </button>
                    )}
                  </div>
                  <Link to={`/bookings/${booking._id}`} className="text-sm text-green-600 hover:text-green-700 font-semibold transition-colors mt-1">
                    Details →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
