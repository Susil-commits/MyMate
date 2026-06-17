import { useState, useEffect } from "react";
import api from "../api/axios";
import { HiUserGroup, HiBadgeCheck, HiClipboardList, HiExclamation, HiCurrencyDollar, HiTrendingUp } from "react-icons/hi";
import toast from "react-hot-toast";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalDrivers: 0, totalUsers: 0, totalBookings: 0, pendingKyc: 0 });
  const [pendingDrivers, setPendingDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recentBookings, setRecentBookings] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, pendingRes, bookingsRes] = await Promise.all([
          api.get("/admin/stats"),
          api.get("/admin/drivers/pending"),
          api.get("/admin/bookings?limit=5"),
        ]);
        setStats(statsRes.data);
        setPendingDrivers(pendingRes.data.drivers);
        setRecentBookings(bookingsRes.data.bookings);
      } catch {
        toast.error("Failed to load admin data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
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

  const statusCounts = { pending: 0, accepted: 0, ongoing: 0, completed: 0, cancelled: 0, rejected: 0 };
  recentBookings.forEach((b) => { if (statusCounts[b.status] !== undefined) statusCounts[b.status]++; });
  const maxCount = Math.max(...Object.values(statusCounts), 1);

  return (
    <div className="animate-fade-in">
      <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">
        <span className="text-purple-600">Admin</span> Dashboard
      </h1>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={<HiUserGroup />} label="Total Drivers" value={stats.totalDrivers} bg="bg-blue-500" />
        <Stat icon={<HiUserGroup />} label="Total Users" value={stats.totalUsers} bg="bg-green-500" />
        <Stat icon={<HiClipboardList />} label="Total Bookings" value={stats.totalBookings} bg="bg-indigo-500" />
        <Stat icon={<HiExclamation />} label="Pending KYC" value={stats.pendingKyc} bg="bg-yellow-500" pulse={stats.pendingKyc > 0} />
      </div>

      <div className="mt-8 grid lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-6">
            <HiTrendingUp className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Booking Status Distribution</h2>
          </div>
          <div className="space-y-3">
            {Object.entries({ pending: "Pending", accepted: "Accepted", ongoing: "Ongoing", completed: "Completed", cancelled: "Cancelled", rejected: "Rejected" }).map(([key, label]) => {
              const count = statusCounts[key];
              const width = (count / maxCount) * 100;
              const colors = {
                pending: "bg-yellow-400",
                accepted: "bg-blue-500",
                ongoing: "bg-indigo-500",
                completed: "bg-green-500",
                cancelled: "bg-red-400",
                rejected: "bg-gray-400",
              };
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-20 capitalize">{label}</span>
                  <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full ${colors[key]} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${width}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-6">
            <HiCurrencyDollar className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Platform Overview</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Active Drivers</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Approved & available</p>
              </div>
              <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">{stats.totalDrivers}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Registered Users</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total customers</p>
              </div>
              <span className="text-2xl font-extrabold text-green-600 dark:text-green-400">{stats.totalUsers}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Total Bookings</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">All time</p>
              </div>
              <span className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">{stats.totalBookings}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white mb-4">Pending KYC Verification</h2>
        {pendingDrivers.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
            <HiBadgeCheck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No drivers pending verification.</p>
          </div>
        ) : (
          <div className="space-y-4 stagger-1">
            {pendingDrivers.map((driver) => (
              <div key={driver._id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 card-hover animate-scale-in">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{driver.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{driver.email} &middot; {driver.phone}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{driver.locality}, {driver.nationality}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">License: {driver.licenseNumber}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{driver.experienceYears}y exp &middot; ${driver.hourlyRate}/hr &middot; ${driver.dailyRate}/day</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {driver.vehicleTypes?.map((v) => (
                        <span key={v} className="px-2 py-0.5 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs rounded-md">{v}</span>
                      ))}
                    </div>
                    {driver.licenseImage?.url && (
                      <a href={driver.licenseImage.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block">
                        View License Image
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleVerify(driver._id, "approved")} className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 hover:shadow-lg transition-all duration-200">
                      Approve
                    </button>
                    <button onClick={() => handleVerify(driver._id, "rejected")} className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 hover:shadow-lg transition-all duration-200">
                      Reject
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

function Stat({ icon, label, value, bg, pulse }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 card-hover">
      <div className={`w-11 h-11 ${bg} ${pulse ? "animate-pulse-soft" : ""} rounded-xl flex items-center justify-center text-white text-lg mb-3`}>{icon}</div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}