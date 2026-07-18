import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { HiStar, HiLocationMarker, HiClock, HiCurrencyDollar, HiBadgeCheck, HiCalendar, HiChat } from "react-icons/hi";
import { FaCar, FaLanguage } from "react-icons/fa";
import BackButton from "../components/BackButton";
import FavoriteButton from "../components/FavoriteButton";
import MapSelector from "../components/MapSelector";
import api from "../api/axios";
import { hireTypes } from "../utils/constants";
import toast from "react-hot-toast";

export default function DriverProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [driver, setDriver] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
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
    const fetchData = async () => {
      try {
        const [driverRes, reviewsRes] = await Promise.all([
          api.get(`/drivers/${id}`),
          api.get(`/reviews/driver/${id}`),
        ]);
        setDriver(driverRes.data.driver);
        setReviews(reviewsRes.data.reviews);
      } catch {
        toast.error("Failed to load driver profile");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleBooking = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/bookings", { driverId: id, ...bookingForm });
      toast.success("Booking request sent!");
      setShowBooking(false);
      navigate("/bookings");
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.bookingId) {
        toast("You already have an active booking with this driver", { icon: "ℹ️" });
        navigate(`/bookings/${err.response.data.bookingId}`);
      } else {
        toast.error(err.response?.data?.message || "Booking failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartConversation = async () => {
    setMessaging(true);
    try {
      const { data } = await api.post("/messages/conversations", { recipientId: id });
      navigate(`/messages/${data.conversation._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not start conversation");
    } finally {
      setMessaging(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="text-center py-20 animate-fade-up">
        <p className="text-gray-500 text-lg">Driver not found.</p>
      </div>
    );
  }

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
    <div className="max-w-4xl mx-auto animate-fade-in">
      <BackButton to="/drivers" label="Back to Drivers" />
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600" />
        <div className="px-8 pb-8">
 <div className="flex flex-col sm items-start gap-6 -mt-12">
            <div className="w-28 h-28 rounded-2xl bg-white shadow-lg border-4 border-white flex items-center justify-center text-4xl font-extrabold text-blue-600">
              {driver.name.charAt(0)}
            </div>
            <div className="flex-1 pt-2">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <h1 className="text-3xl font-extrabold text-gray-900">{driver.name}</h1>
                  <div className="flex items-center gap-2 mt-1 text-gray-500">
                    <HiLocationMarker className="w-4 h-4" />
                    {driver.locality} &middot; {driver.nationality}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${availabilityColor[driver.availability]}`}>
                    {driver.availability}
                  </span>
                  <FavoriteButton driverId={driver._id} />
                  <button
                    onClick={handleStartConversation}
                    disabled={messaging}
                    className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-all duration-200"
                  >
                    <HiChat className="w-4 h-4" />
                    Message
                  </button>
                  <button
                    onClick={() => setShowBooking(true)}
                    disabled={driver.availability !== "available"}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all duration-300 hover:-translate-y-0.5"
                  >
                    {driver.availability === "available" ? "Book Now" : "Not Available"}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1 mt-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <HiStar
                    key={star}
                    className={`w-5 h-5 ${star <= Math.round(driver.averageRating) ? "text-yellow-500" : "text-gray-300"}`}
                  />
                ))}
                <span className="ml-2 text-lg font-bold text-gray-900">{driver.averageRating || "New"}</span>
                <span className="text-sm text-gray-500">({driver.totalReviews} reviews)</span>
              </div>
            </div>
          </div>

 <div className="mt-8 grid grid-cols-2 md gap-4">
            <Stat icon={<HiClock />} label="Experience" value={`${driver.experienceYears} years`} />
            <Stat icon={<HiBadgeCheck />} label="Verification" value={driver.documentsVerified ? "Verified" : "Pending"} color={driver.documentsVerified ? "text-green-600" : "text-yellow-600"} />
            <Stat icon={<HiCurrencyDollar />} label="Hourly" value={`₹${driver.hourlyRate}`} />
            <Stat icon={<HiCurrencyDollar />} label="Daily" value={`₹${driver.dailyRate}`} />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-sm font-medium">
              <FaCar /> {driver.vehicleTypes?.join(", ")}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-sm font-medium">
              <FaLanguage /> {driver.languages?.join(", ") || "Not specified"}
            </span>
          </div>

          {driver.bio && (
            <p className="mt-6 text-gray-600 leading-relaxed">{driver.bio}</p>
          )}
        </div>
      </div>

      {showBooking && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowBooking(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <HiCalendar className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-extrabold text-gray-900">Book {driver.name}</h2>
            </div>
            <form onSubmit={handleBooking} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Hire Type</label>
                <select
                  value={bookingForm.hireType}
                  onChange={(e) => setBookingForm({ ...bookingForm, hireType: e.target.value })}
 className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200"
                >
                  {hireTypes.map((h) => (
                    <option key={h.value} value={h.value}>{h.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Start Date</label>
 <input type="date" required value={bookingForm.startDate} onChange={(e) => setBookingForm({ ...bookingForm, startDate: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">End Date</label>
  <input type="date" min={bookingForm.startDate || undefined} value={bookingForm.endDate} onChange={(e) => setBookingForm({ ...bookingForm, endDate: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200" />
                </div>
              </div>
              <MapSelector label="Pickup Location" value={bookingForm.pickupLocation} onChange={(v) => setBookingForm({ ...bookingForm, pickupLocation: v })} />
              <MapSelector label="Drop Location (optional)" value={bookingForm.dropLocation} onChange={(v) => setBookingForm({ ...bookingForm, dropLocation: v })} />
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Purpose</label>
  <textarea required value={bookingForm.purpose} onChange={(e) => setBookingForm({ ...bookingForm, purpose: e.target.value })} rows={2} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none transition-all duration-200" placeholder="e.g. Airport pickup, daily commute..." />
              </div>
              {bookingForm.startDate && estimatedAmount > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-700">Estimated Total</span>
                    <span className="text-xl font-extrabold text-blue-900">₹{estimatedAmount.toLocaleString("en-IN")}</span>
                  </div>
                  <p className="text-xs text-blue-500 mt-1">
                    {bookingForm.hireType === "temporary"
                      ? `${bookingForm.endDate ? Math.ceil((new Date(bookingForm.endDate) - new Date(bookingForm.startDate)) / (1000 * 60 * 60)) : 1} hour(s) × ₹${driver.hourlyRate}/hr`
                      : `${bookingForm.endDate ? Math.ceil((new Date(bookingForm.endDate) - new Date(bookingForm.startDate)) / (1000 * 60 * 60 * 24)) : 30} day(s) × ₹${driver.dailyRate}/day`}
                  </p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowBooking(false)} className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-600 hover:bg-gray-50 transition-all duration-200">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all duration-300">
                  {submitting ? "Sending..." : "Send Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mt-8">
        <h3 className="text-xl font-extrabold text-gray-900 mb-6">Reviews ({reviews.length})</h3>
        {reviews.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <HiStar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No reviews yet.</p>
          </div>
        ) : (
          <div className="space-y-4 stagger-1">
            {reviews.map((review) => (
              <div key={review._id} className="bg-white rounded-2xl border border-gray-100 p-6 animate-scale-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white text-sm font-bold">
                      {review.user?.name?.charAt(0)}
                    </div>
                    <span className="font-semibold text-gray-900">{review.user?.name}</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <HiStar key={i} className={`w-4 h-4 ${i < review.rating ? "text-yellow-500" : "text-gray-200"}`} />
                    ))}
                  </div>
                </div>
                {review.comment && <p className="mt-3 text-gray-600 text-sm leading-relaxed">{review.comment}</p>}
                <p className="mt-2 text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, color }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
      <span className={`${color || "text-blue-600"} text-lg`}>{icon}</span>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, required }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
 <input type="text" required={required} value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200" />
    </div>
  );
}
