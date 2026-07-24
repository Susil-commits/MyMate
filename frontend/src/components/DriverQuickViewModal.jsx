import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HiStar, HiLocationMarker, HiClock, HiCurrencyDollar, HiBadgeCheck, HiCalendar, HiChat, HiX } from "react-icons/hi";
import { FaCar, FaLanguage } from "react-icons/fa";
import FavoriteButton from "./FavoriteButton";
import MapSelector from "./MapSelector";
import api from "../api/axios";
import { hireTypes } from "../utils/constants";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

export default function DriverQuickViewModal({ driverId, onClose }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Booking state
  const [showBooking, setShowBooking] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    hireType: "temporary",
    startDate: "",
    endDate: "",
    pickupLocation: "",
    dropLocation: "",
    purpose: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [messaging, setMessaging] = useState(false);

  useEffect(() => {
    if (!driverId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [driverRes] = await Promise.all([
          api.get(`/drivers/${driverId}`),
          api.get(`/reviews/driver/${driverId}`),
        ]);
        setDriver(driverRes.data.driver);
      } catch {
        toast.error("Failed to load driver profile");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [driverId]);

  const handleBooking = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/bookings", { driverId, ...bookingForm });
      toast.success("Booking request sent!");
      setShowBooking(false);
      onClose(); // Close modal on success
      navigate("/bookings");
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.bookingId) {
        toast("You already have an active booking with this driver", { icon: "ℹ️" });
        onClose();
        navigate(`/bookings/${err.response.data.bookingId}`);
      } else {
        toast.error(err.response?.data?.message || "Booking failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartConversation = async () => {
    if (!user) {
      toast("Please log in to message drivers", { icon: "🔒" });
      onClose();
      navigate("/user/login");
      return;
    }
    setMessaging(true);
    try {
      const { data } = await api.post("/messages/conversations", { recipientId: driverId });
      onClose();
      navigate(`/messages/${data.conversation._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not start conversation");
    } finally {
      setMessaging(false);
    }
  };

  const availabilityColor = {
    available: "bg-green-100 text-green-700",
    busy: "bg-yellow-100 text-yellow-700",
    offline: "bg-gray-100 text-gray-500",
  };

  const estimatedAmount = (() => {
    if (!driver || !bookingForm.startDate) return 0;
    const start = new Date(bookingForm.startDate);
    const end = bookingForm.endDate ? new Date(bookingForm.endDate) : null;
    if (isNaN(start.getTime()) || (end && isNaN(end.getTime()))) return 0;
    if (end && end < start) return 0;
    if (bookingForm.hireType === "temporary") {
      const hours = end ? Math.ceil((end - start) / (1000 * 60 * 60)) : 1;
      return hours * (driver.hourlyRate || 0);
    }
    const days = end ? Math.ceil((end - start) / (1000 * 60 * 60 * 24)) : 30;
    return days * (driver.dailyRate || 0);
  })();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6 animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-scale-in"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-white/50 hover:bg-white rounded-full text-gray-900 transition-colors shadow-sm"
        >
          <HiX className="w-6 h-6" />
        </button>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mb-4" />
            <p className="text-gray-500 font-medium animate-pulse">Loading Profile...</p>
          </div>
        ) : !driver ? (
          <div className="p-12 text-center h-64 flex flex-col items-center justify-center">
            <p className="text-gray-500 text-lg">Driver not found.</p>
          </div>
        ) : (
          <div className="pb-8">
            <div className="h-40 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 rounded-t-3xl" />
            <div className="px-6 sm:px-10 -mt-16">
              <div className="flex flex-col sm:flex-row sm:items-end gap-6">
                <div className="w-32 h-32 rounded-2xl bg-white shadow-xl border-4 border-white flex items-center justify-center text-5xl font-extrabold text-blue-600 shrink-0">
                  {driver.name.charAt(0)}
                </div>
                
                <div className="flex-1 pb-2">
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                      <h1 className="text-3xl font-extrabold text-gray-900 leading-tight">{driver.name}</h1>
                      <div className="flex items-center gap-2 mt-1.5 text-gray-500 font-medium">
                        <HiLocationMarker className="w-5 h-5 text-gray-400" />
                        {driver.locality} &middot; {driver.nationality}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className={`px-4 py-1.5 rounded-full text-sm font-bold capitalize shadow-sm ${availabilityColor[driver.availability]}`}>
                        {driver.availability}
                      </span>
                      <FavoriteButton driverId={driver._id} />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 mt-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <HiStar
                        key={star}
                        className={`w-5 h-5 ${star <= Math.round(driver.averageRating) ? "text-yellow-500" : "text-gray-200"}`}
                      />
                    ))}
                    <span className="ml-1 text-lg font-bold text-gray-900">{driver.averageRating || "New"}</span>
                    <span className="text-sm text-gray-500">({driver.totalReviews} reviews)</span>
                  </div>
                </div>
              </div>

              <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat icon={<HiClock />} label="Experience" value={`${driver.experienceYears} years`} />
                <Stat icon={<HiBadgeCheck />} label="Verification" value={driver.documentsVerified ? "Verified" : "Pending"} color={driver.documentsVerified ? "text-green-600" : "text-yellow-600"} />
                <Stat icon={<HiCurrencyDollar />} label="Hourly" value={`₹${driver.hourlyRate}`} />
                <Stat icon={<HiCurrencyDollar />} label="Daily" value={`₹${driver.dailyRate}`} />
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-100 text-gray-700 rounded-xl font-semibold">
                  <FaCar className="text-blue-500" /> {driver?.vehicleTypes?.join(", ")}
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-100 text-gray-700 rounded-xl font-semibold">
                  <FaLanguage className="text-blue-500" /> {driver?.languages?.join(", ") || "Not specified"}
                </span>
              </div>

              {driver.bio && (
                <div className="mt-8">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">About Driver</h3>
                  <p className="text-gray-600 leading-relaxed text-[15px]">{driver.bio}</p>
                </div>
              )}

              <div className="mt-10 pt-8 border-t border-gray-100 flex gap-4">
                <button
                  onClick={handleStartConversation}
                  disabled={messaging}
                  className="flex-1 py-4 bg-gray-50 hover:bg-gray-100 text-gray-900 rounded-2xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <HiChat className="w-5 h-5 text-blue-600" />
                  Message Driver
                </button>
                <button
                  onClick={() => {
                    if (!user) {
                      toast("Please log in to book drivers", { icon: "🔒" });
                      onClose();
                      navigate("/user/login");
                      return;
                    }
                    setShowBooking(true);
                  }}
                  disabled={driver.availability !== "available"}
                  className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all hover:shadow-lg disabled:opacity-50 disabled:hover:shadow-none flex items-center justify-center gap-2"
                >
                  <HiCalendar className="w-5 h-5" />
                  {driver.availability === "available" ? "Book Now" : "Not Available"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Booking Form Sub-Modal */}
      {showBooking && driver && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-fade-in" onClick={(e) => { e.stopPropagation(); setShowBooking(false); }}>
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto relative animate-scale-in" onClick={(e) => e.stopPropagation()}>
             <button 
              onClick={() => setShowBooking(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:bg-gray-50 rounded-full transition-colors"
            >
              <HiX className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <HiCalendar className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900">Book {driver.name}</h2>
            </div>
            
            <form onSubmit={handleBooking} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Hire Type</label>
                <select
                  value={bookingForm.hireType}
                  onChange={(e) => setBookingForm({ ...bookingForm, hireType: e.target.value })}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium transition-all"
                >
                  {hireTypes.map((h) => (
                    <option key={h.value} value={h.value}>{h.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Start Date</label>
                  <input type="date" required value={bookingForm.startDate} onChange={(e) => setBookingForm({ ...bookingForm, startDate: e.target.value })} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">End Date</label>
                  <input type="date" min={bookingForm.startDate || undefined} value={bookingForm.endDate} onChange={(e) => setBookingForm({ ...bookingForm, endDate: e.target.value })} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
                </div>
              </div>
              <MapSelector label="Pickup Location" value={bookingForm.pickupLocation} onChange={(v) => setBookingForm({ ...bookingForm, pickupLocation: v })} />
              <MapSelector label="Drop Location (optional)" value={bookingForm.dropLocation} onChange={(v) => setBookingForm({ ...bookingForm, dropLocation: v })} />
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Purpose</label>
                <textarea required value={bookingForm.purpose} onChange={(e) => setBookingForm({ ...bookingForm, purpose: e.target.value })} rows={2} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none transition-all" placeholder="e.g. Airport pickup, daily commute..." />
              </div>
              {bookingForm.startDate && estimatedAmount > 0 && (
                <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-blue-800">Estimated Total</span>
                    <span className="text-2xl font-extrabold text-blue-900">₹{estimatedAmount.toLocaleString("en-IN")}</span>
                  </div>
                  <p className="text-xs font-semibold text-blue-600/70">
                    {bookingForm.hireType === "temporary"
                      ? `${bookingForm.endDate ? Math.ceil((new Date(bookingForm.endDate) - new Date(bookingForm.startDate)) / (1000 * 60 * 60)) : 1} hour(s) × ₹${driver.hourlyRate}/hr`
                      : `${bookingForm.endDate ? Math.ceil((new Date(bookingForm.endDate) - new Date(bookingForm.startDate)) / (1000 * 60 * 60 * 24)) : 30} day(s) × ₹${driver.dailyRate}/day`}
                  </p>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowBooking(false)} className="flex-1 py-4 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
                  {submitting ? "Sending Request..." : "Confirm Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, color }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
      <span className={`${color || "text-blue-600"} text-xl`}>{icon}</span>
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="font-extrabold text-gray-900 text-sm mt-0.5">{value}</p>
      </div>
    </div>
  );
}
