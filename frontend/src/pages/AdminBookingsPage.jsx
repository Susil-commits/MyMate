import { useState, useEffect } from "react";
import api from "../api/axios";
import { bookingStatusColors, paymentStatusColors, formatINR } from "../utils/constants";
import { WindowedPagination } from "../components/WindowedPagination";
import ConfirmDialog from "../components/ConfirmDialog";
import { SkeletonTable } from "../components/SkeletonLoader";
import toast from "react-hot-toast";

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [refundTarget, setRefundTarget] = useState(null);
  const [refunding, setRefunding] = useState(false);

  useEffect(() => {
    let active = true;
    const fetch = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page, limit: 20 });
        if (statusFilter) params.set("status", statusFilter);
        const { data } = await api.get(`/admin/bookings?${params}`);
        if (!active) return;
        setBookings(data.bookings);
        setPagination(data.pagination);
      } catch (err) {
        if (active) console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetch();
    return () => {
      active = false;
    };
  }, [page, statusFilter]);

  const handleFilterChange = (val) => {
    setStatusFilter(val);
    setPage(1);
  };

  const handleStatus = async (bookingId, status) => {
    setActionLoading(`${bookingId}-${status}`);
    try {
      const { data } = await api.put(`/bookings/${bookingId}/status`, { status });
      setBookings((prev) => prev.map((b) => (b._id === bookingId ? data.booking : b)));
      toast.success(`Booking ${status}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefund = async () => {
    if (!refundTarget) return;
    setRefunding(true);
    try {
      await api.post("/payments/refund", { bookingId: refundTarget });
      setBookings((prev) =>
        prev.map((b) => (b._id === refundTarget ? { ...b, paymentStatus: "refunded" } : b))
      );
      toast.success("Refund processed");
      setRefundTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Refund failed");
    } finally {
      setRefunding(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">All Bookings</h1>
            <p className="text-sm text-gray-500 mt-1">Loading bookings...</p>
          </div>
        </div>
        <SkeletonTable rows={5} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">All Bookings</h1>
          <p className="text-sm text-gray-500 mt-1">{pagination.total} bookings</p>
        </div>
        <select value={statusFilter} onChange={(e) => handleFilterChange(e.target.value)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all duration-200">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="ongoing">Ongoing</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      <div className="space-y-4 stagger-1">
        {!bookings?.length ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <p className="text-gray-500">No bookings found.</p>
          </div>
        ) : (
          bookings?.map?.((b) => (
            <div key={b._id} className="bg-white rounded-2xl border border-gray-100 p-5 animate-scale-in">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900">{b.user?.name} → {b.driver?.name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {b.hireType === "temporary" ? "Temporary" : "Permanent"} &middot; {new Date(b.startDate).toLocaleDateString()} &middot; {formatINR(b.totalAmount)}
                  </p>
                  <p className="text-sm text-gray-500">{b.pickupLocation}{b.dropLocation ? ` → ${b.dropLocation}` : ""} &middot; {b.purpose}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${bookingStatusColors[b.status]}`}>{b.status}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${paymentStatusColors[b.paymentStatus] || "bg-gray-100 text-gray-500"}`}>{b.paymentStatus}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 flex-shrink-0">
                  {b.status === "pending" && (
                    <>
                      <button disabled={actionLoading === `${b._id}-accepted`} onClick={() => handleStatus(b._id, "accepted")} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-all duration-200">Accept</button>
                      <button disabled={actionLoading === `${b._id}-rejected`} onClick={() => handleStatus(b._id, "rejected")} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600 disabled:opacity-50 transition-all duration-200">Reject</button>
                    </>
                  )}
                  {b.status === "accepted" && (
                    <button disabled={actionLoading === `${b._id}-ongoing`} onClick={() => handleStatus(b._id, "ongoing")} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all duration-200">Start</button>
                  )}
                  {b.status === "ongoing" && (
                    <button disabled={actionLoading === `${b._id}-completed`} onClick={() => handleStatus(b._id, "completed")} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-all duration-200">Complete</button>
                  )}
                  {["pending", "accepted", "ongoing"].includes(b.status) && (
                    <button disabled={actionLoading === `${b._id}-cancelled`} onClick={() => handleStatus(b._id, "cancelled")} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600 disabled:opacity-50 transition-all duration-200">Cancel</button>
                  )}
                  {b.paymentStatus === "paid" && (
                    <button disabled={actionLoading === `${b._id}-refund`} onClick={() => setRefundTarget(b._id)} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 disabled:opacity-50 transition-all duration-200">Refund</button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <WindowedPagination page={pagination.page} pages={pagination.pages} onChange={setPage} accent="purple" />

      <ConfirmDialog
        open={!!refundTarget}
        title="Process Refund"
        message="This will reverse the Razorpay payment. The user will receive their money back. This action cannot be undone."
        confirmLabel="Yes, Refund"
        variant="warning"
        loading={refunding}
        onConfirm={handleRefund}
        onCancel={() => setRefundTarget(null)}
      />
    </div>
  );
}
