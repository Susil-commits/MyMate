import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  HiCurrencyDollar,
  HiClipboardList,
  HiCheck,
  HiLocationMarker,
  HiClock,
  HiCheckCircle,
  HiX,
  HiBell,
} from "react-icons/hi";
import { FaCar } from "react-icons/fa";
import api from "../api/axios";
import { bookingStatusColors, formatINR } from "../utils/constants";
import { SkeletonDashboard } from "../components/SkeletonLoader";
import HeatmapDisplay from "../components/HeatmapDisplay";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import toast from "react-hot-toast";

interface DriverBookingSummary {
  _id: string;
  user?: {
    name?: string;
  };
  pickupLocation: string;
  totalAmount: number;
  status: "pending" | "accepted" | "ongoing" | "completed" | "cancelled" | "rejected";
}

interface WalletTxn {
  _id: string;
  type: "credit" | "debit";
  description: string;
  amount: number;
  createdAt: string;
}

interface DispatchOffer {
  bookingId: string;
  customerName: string;
  pickupLocation: string;
  dropLocation?: string;
  hireType: string;
  totalAmount: number;
  startDate: string;
  expiresIn: number;
}

const playDispatchChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.12);
      osc.stop(ctx.currentTime + idx * 0.12 + 0.3);
    });
  } catch {
    // Non-fatal if audio context is restricted
  }
};

export default function DriverDashboard() {
  const { user: driver, loadUser } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalBookings: 0, completedBookings: 0, earnings: 0, pendingBookings: 0 });
  const [recentBookings, setRecentBookings] = useState<DriverBookingSummary[]>([]);
  const [wallet, setWallet] = useState<{ balance: number; transactions: WalletTxn[] }>({ balance: 0, transactions: [] });
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Incoming Live Dispatch Offer State
  const [incomingOffer, setIncomingOffer] = useState<DispatchOffer | null>(null);
  const [countdown, setCountdown] = useState<number>(45);
  const [acceptingOffer, setAcceptingOffer] = useState<boolean>(false);

  // Real-time GPS Telemetry Beacon to Redis GEO
  useEffect(() => {
    if (driver?.availability !== "available" || !socket) return;

    let watchId: number | null = null;
    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          socket.emit("location_update", {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: pos.coords.heading || 0,
          });
        },
        (err) => console.warn("GPS telemetry:", err),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [driver?.availability, socket]);

  // Listen for real-time dispatch offers from cluster
  useEffect(() => {
    if (!socket) return;

    const handleOffer = (offer: DispatchOffer) => {
      setIncomingOffer(offer);
      setCountdown(offer.expiresIn || 45);
      playDispatchChime();
    };

    socket.on("new_dispatch_offer", handleOffer);
    return () => {
      socket.off("new_dispatch_offer", handleOffer);
    };
  }, [socket]);

  // 45-Second Countdown
  useEffect(() => {
    if (!incomingOffer) return;
    if (countdown <= 0) {
      setIncomingOffer(null);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [incomingOffer, countdown]);

  const handleAcceptOffer = async () => {
    if (!incomingOffer) return;
    setAcceptingOffer(true);
    try {
      await api.put(`/bookings/${incomingOffer.bookingId}/status`, { status: "accepted" });
      toast.success("Ride request accepted! Directing to booking details...");
      const id = incomingOffer.bookingId;
      setIncomingOffer(null);
      navigate(`/bookings/${id}`);
    } catch (err: any) {
      const msg = err.response?.data?.message || "Offer already expired or accepted";
      toast.error(msg);
      setIncomingOffer(null);
    } finally {
      setAcceptingOffer(false);
    }
  };

  const handleDeclineOffer = () => {
    setIncomingOffer(null);
  };

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
        setRecentBookings(bookingsRes.data.bookings || []);
        setWallet({
          balance: walletRes.data.walletBalance || 0,
          transactions: walletRes.data.transactions || [],
        });
      } catch {
        if (active) console.error("Failed to load dashboard");
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => {
      active = false;
    };
  }, []);

  const handleToggleAvailability = async () => {
    if (updatingStatus) return;
    setUpdatingStatus(true);
    const newStatus = driver?.availability === "available" ? "offline" : "available";
    try {
      await api.put("/drivers/profile", { availability: newStatus });
      await loadUser();
      toast.success(`You are now ${newStatus}`);
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-6">
          <span className="gradient-text">Dashboard</span>
        </h1>
        <SkeletonDashboard />
      </div>
    );
  }

  const isAvailable = driver?.availability === "available";

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-extrabold text-gray-900">
          <span className="gradient-text">Dashboard</span>
        </h1>
        
        {/* Live Availability Toggle */}
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
          <span className="text-sm font-bold text-gray-700">Status:</span>
          <button
            onClick={handleToggleAvailability}
            disabled={updatingStatus}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none ${isAvailable ? "bg-green-500" : "bg-gray-300"} disabled:opacity-50`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${isAvailable ? "translate-x-6" : "translate-x-1"}`}
            />
          </button>
          <span className={`text-sm font-bold ${isAvailable ? "text-green-600" : "text-gray-500"} min-w-[70px]`}>
            {isAvailable ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<HiClipboardList />} label="Total Bookings" value={stats.totalBookings} bg="bg-blue-500" />
        <StatCard icon={<HiCheck />} label="Completed" value={stats.completedBookings} bg="bg-green-500" />
        <StatCard icon={<HiCurrencyDollar />} label="Wallet Balance" value={`₹${wallet.balance.toLocaleString("en-IN")}`} bg="bg-indigo-500" />
        <StatCard icon={<HiCurrencyDollar />} label="Total Earnings" value={`₹${stats.earnings.toLocaleString("en-IN")}`} bg="bg-purple-500" />
      </div>

      <div className="mt-8">
        <HeatmapDisplay />
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
                      {booking.user?.name?.charAt(0) || "U"}
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

      {/* Real-time Uber/Lyft Style Incoming Dispatch Offer Modal */}
      {incomingOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-800 space-y-6 relative overflow-hidden animate-scale-in">
            {/* Top Bar with Pulsing Radar & Countdown */}
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping"></span>
                Incoming Ride Offer
              </div>

              {/* Circular countdown counter */}
              <div className="relative w-12 h-12 flex items-center justify-center">
                <svg className="w-12 h-12 transform -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="text-gray-200 dark:text-gray-700"
                    fill="transparent"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="text-blue-600 transition-all duration-1000 ease-linear"
                    fill="transparent"
                    strokeDasharray={126}
                    strokeDashoffset={126 - (126 * countdown) / 45}
                  />
                </svg>
                <span className="absolute text-sm font-black text-gray-900 dark:text-white">
                  {countdown}s
                </span>
              </div>
            </div>

            {/* Fare & Customer */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                Guaranteed Trip Payout
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <h3 className="text-3xl font-black">{formatINR(incomingOffer.totalAmount)}</h3>
                <span className="text-xs font-bold px-2.5 py-1 rounded bg-white/20 capitalize">
                  {incomingOffer.hireType}
                </span>
              </div>
              <p className="text-xs text-blue-100 mt-2 flex items-center gap-1.5">
                <span>Customer:</span>
                <strong className="text-white">{incomingOffer.customerName}</strong>
              </p>
            </div>

            {/* Route Details */}
            <div className="space-y-3 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl text-xs">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center font-bold text-[10px] mt-0.5">
                  A
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">PICKUP LOCATION</span>
                  <p className="font-bold text-gray-900 dark:text-white mt-0.5">
                    {incomingOffer.pickupLocation}
                  </p>
                </div>
              </div>

              {incomingOffer.dropLocation && (
                <div className="flex items-start gap-2.5 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 flex items-center justify-center font-bold text-[10px] mt-0.5">
                    B
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[11px]">DESTINATION</span>
                    <p className="font-bold text-gray-900 dark:text-white mt-0.5">
                      {incomingOffer.dropLocation}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleDeclineOffer}
                disabled={acceptingOffer}
                className="py-3 px-4 rounded-xl text-sm font-bold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={handleAcceptOffer}
                disabled={acceptingOffer}
                className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/25 transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <HiCheckCircle className="w-5 h-5" />
                {acceptingOffer ? "Accepting..." : "Accept Ride"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  bg: string;
}

function StatCard({ icon, label, value, bg }: StatCardProps) {
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
