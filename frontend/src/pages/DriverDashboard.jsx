import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { HiCurrencyDollar, HiClipboardList, HiCheck, HiUsers } from "react-icons/hi";
import api from "../api/axios";
import { bookingStatusColors } from "../utils/constants";

export default function DriverDashboard() {
  const [stats, setStats] = useState({ totalBookings: 0, completedBookings: 0, earnings: 0, pendingBookings: 0 });
  const [recentBookings, setRecentBookings] = useState([]);
  const [wallet, setWallet] = useState({ balance: 0, transactions: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      try {
        const [statsRes, bookingsRes, walletRes] = await Promise.all([
          api.get("/bookings/driver/stats"),
          api.get("/bookings/driver?limit=5"),
          api.get("/drivers/wallet"),
        ]);
        if (!active) return;
        setStats(statsRes.data);
        setRecentBookings(bookingsRes.data.bookings);
        setWallet({ balance: walletRes.data.walletBalance, transactions: walletRes.data.transactions });
      } catch (err) {
        if (active) console.error("Failed to load dashboard:", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-green-200 border-t-green-600" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-3xl font-extrabold text-gray-900">
        <span className="gradient-text">Dashboard</span>
      </h1>

 <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<HiClipboardList />} label="Total Bookings" value={stats.totalBookings} bg="bg-blue-500" />
        <StatCard icon={<HiCheck />} label="Completed" value={stats.completedBookings} bg="bg-green-500" />
        <StatCard icon={<HiCurrencyDollar />} label="Wallet Balance" value={`₹${wallet.balance.toLocaleString("en-IN")}`} bg="bg-indigo-500" />
        <StatCard icon={<HiCurrencyDollar />} label="Total Earnings" value={`₹${stats.earnings.toLocaleString("en-IN")}`} bg="bg-purple-500" />
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-extrabold text-gray-900">Recent Bookings</h2>
          <Link to="/driver/bookings" className="text-sm text-green-600 hover:text-green-700 font-semibold transition-colors">
            View All →
          </Link>
        </div>
        {recentBookings.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <HiClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No bookings yet. Complete your profile to get started.</p>
          </div>
        ) : (
          <div className="space-y-3 stagger-1">
            {recentBookings.map((booking) => (
              <Link
                key={booking._id}
                to={`/bookings/${booking._id}`}
                className="block bg-white rounded-2xl border border-gray-100 p-5 card-hover animate-scale-in"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg">
                      {booking.user?.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{booking.user?.name}</p>
                      <p className="text-sm text-gray-500">
                        {booking.pickupLocation} &middot; ₹{booking.totalAmount}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${bookingStatusColors[booking.status]}`}>
                    {booking.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-extrabold text-gray-900 mb-4">Recent Transactions</h2>
        {wallet.transactions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <HiCurrencyDollar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No transactions yet.</p>
          </div>
        ) : (
          <div className="space-y-3 stagger-1">
            {wallet.transactions.slice(0, 5).map((txn) => (
              <div key={txn._id} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center justify-between card-hover">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${txn.type === "credit" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                    <HiCurrencyDollar className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{txn.description}</p>
                    <p className="text-xs text-gray-500">{new Date(txn.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className={`font-bold ${txn.type === "credit" ? "text-green-600" : "text-red-600"}`}>
                  {txn.type === "credit" ? "+" : "-"}₹{txn.amount.toLocaleString("en-IN")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, bg }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 card-hover">
      <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center text-white text-lg mb-3`}>
        {icon}
      </div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}
