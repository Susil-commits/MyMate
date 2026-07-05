import { useState, useEffect } from "react";
import api from "../api/axios";
import { HiUserGroup, HiBadgeCheck, HiClipboardList, HiExclamation, HiCurrencyDollar, HiTrendingUp, HiCheck, HiX } from "react-icons/hi";
import toast from "react-hot-toast";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalDrivers: 0, activeDrivers: 0, totalUsers: 0, totalBookings: 0, pendingKyc: 0, completedBookings: 0, cancelledBookings: 0, revenue: 0 });
  const [pendingDrivers, setPendingDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recentBookings, setRecentBookings] = useState([]);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      try {
        const [statsRes, pendingRes, bookingsRes] = await Promise.all([
          api.get("/admin/stats"),
          api.get("/admin/drivers/pending"),
          api.get("/admin/bookings?limit=5"),
        ]);
        if (!active) return;
        setStats(statsRes.data);
        setPendingDrivers(pendingRes.data.drivers);
        setRecentBookings(bookingsRes.data.bookings);
      } catch {
        if (active) toast.error("Failed to load admin data");
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => {
      active = false;
    };
  }, []);

  const handleVerify = async (driverId, status) => {
    try {
      await api.put(`/admin/drivers/${driverId}/verify`, { status });
      setPendingDrivers((prev) => prev.filter((d) => d._id !== driverId));
      setStats((prev) => ({ ...prev, pendingKyc: prev.pendingKyc - 1 }));
      toast.success(`Driver ${status === "approved" ? "approved" : "rejected"}`);
    } catch {
      toast.error("Failed to update driver");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-200 border-t-purple-600" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-3xl font-extrabold text-gray-900">
        <span className="text-purple-600">Admin</span> Dashboard
      </h1>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={<HiUserGroup />} label="Total Drivers" value={stats.totalDrivers} sub={`${stats.activeDrivers} active`} bg="bg-blue-500" />
        <Stat icon={<HiUserGroup />} label="Total Users" value={stats.totalUsers} bg="bg-green-500" />
        <Stat icon={<HiClipboardList />} label="Total Bookings" value={stats.totalBookings} sub={`${stats.completedBookings} completed`} bg="bg-indigo-500" />
        <Stat icon={<HiExclamation />} label="Pending KYC" value={stats.pendingKyc} bg="bg-yellow-500" pulse={stats.pendingKyc > 0} />
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white card-glow md:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-50 text-sm font-medium">Platform Revenue</p>
              <p className="text-4xl font-extrabold mt-1">${stats.revenue}</p>
              <p className="text-green-100 text-xs mt-2">From {stats.completedBookings} completed bookings</p>
            </div>
            <HiCurrencyDollar className="w-12 h-12 text-green-200" />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <HiTrendingUp className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-bold text-gray-900">Booking Breakdown</h2>
          </div>
          <div className="space-y-3">
            <Row label="Completed" value={stats.completedBookings} color="bg-green-500" total={stats.totalBookings} />
            <Row label="Cancelled / Rejected" value={stats.cancelledBookings} color="bg-red-400" total={stats.totalBookings} />
            <Row label="Active / Pending" value={Math.max(0, stats.totalBookings - stats.completedBookings - stats.cancelledBookings)} color="bg-blue-500" total={stats.totalBookings} />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <HiClipboardList className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-gray-900">Recent Bookings</h2>
          </div>
          <div className="space-y-3">
            {recentBookings.length === 0 ? (
              <p className="text-sm text-gray-400">No bookings yet.</p>
            ) : (
              recentBookings.map((b) => (
                <div key={b._id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{b.user?.name} → {b.driver?.name}</p>
                    <p className="text-xs text-gray-500">${b.totalAmount}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize flex-shrink-0 ${
                    b.status === "completed" ? "bg-green-100 text-green-700" :
                    b.status === "cancelled" ? "bg-red-100 text-red-700" :
                    "bg-yellow-100 text-yellow-700"
                  }`}>{b.status}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-extrabold text-gray-900 mb-4">Pending KYC Verification</h2>
        {pendingDrivers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <HiBadgeCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No drivers pending verification.</p>
          </div>
        ) : (
          <div className="space-y-4 stagger-1">
            {pendingDrivers.map((driver) => (
              <div key={driver._id} className="bg-white rounded-2xl border border-gray-100 p-6 animate-scale-in">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-gray-900">{driver.name}</h3>
                    <p className="text-sm text-gray-500">{driver.email} &middot; {driver.phone}</p>
                    <p className="text-sm text-gray-500">{driver.locality}, {driver.nationality}</p>
                    <p className="text-sm text-gray-500">License: {driver.licenseNumber}</p>
                    <p className="text-sm text-gray-500">{driver.experienceYears}y exp &middot; ${driver.hourlyRate}/hr &middot; ${driver.dailyRate}/day</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {driver.vehicleTypes?.map((v) => (
                        <span key={v} className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-md">{v}</span>
                      ))}
                    </div>
                    {driver.licenseImage?.url && (
                      <a href={driver.licenseImage.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-700 hover:underline mt-2 inline-block">
                        View License Image
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleVerify(driver._id, "approved")} className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-all duration-200">
                      <HiCheck className="w-4 h-4" /> Approve
                    </button>
                    <button onClick={() => handleVerify(driver._id, "rejected")} className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-all duration-200">
                      <HiX className="w-4 h-4" /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, sub, bg, pulse }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 card-hover">
      <div className={`w-11 h-11 ${bg} ${pulse ? "animate-pulse-soft" : ""} rounded-xl flex items-center justify-center text-white text-lg mb-3`}>{icon}</div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-extrabold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Row({ label, value, color, total }) {
  const width = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className="text-xs font-semibold text-gray-700">{value}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
