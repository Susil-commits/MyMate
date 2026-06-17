import { useState, useEffect } from "react";
import api from "../api/axios";
import { bookingStatusColors } from "../utils/constants";

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/admin/bookings?page=${page}&limit=20`);
        setBookings(data.bookings);
        setPagination(data.pagination);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [page]);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-200 border-t-purple-600" /></div>;

  return (
    <div className="animate-fade-in">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-6">All Bookings</h1>
      <div className="space-y-4 stagger-1">
        {bookings.map((b) => (
          <div key={b._id} className="bg-white rounded-2xl border border-gray-100 p-5 card-hover animate-scale-in">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold">{b.user?.name} → {b.driver?.name}</p>
                <p className="text-sm text-gray-500">{b.hireType} &middot; {new Date(b.startDate).toLocaleDateString()} &middot; ${b.totalAmount}</p>
                <p className="text-sm text-gray-500">{b.pickupLocation} &middot; {b.purpose}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${bookingStatusColors[b.status]}`}>{b.status}</span>
            </div>
          </div>
        ))}
      </div>
      {pagination.pages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          <button disabled={pagination.page <= 1} onClick={() => setPage(page - 1)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">Prev</button>
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)} className={`px-4 py-2 rounded-xl text-sm font-semibold ${p === pagination.page ? "bg-purple-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>{p}</button>
          ))}
          <button disabled={pagination.page >= pagination.pages} onClick={() => setPage(page + 1)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
        </div>
      )}
    </div>
  );
}