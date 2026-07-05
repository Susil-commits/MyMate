import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { HiStar, HiCalendar, HiLocationMarker, HiUser, HiCash, HiCheckCircle } from "react-icons/hi";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import BackButton from "../components/BackButton";
import ConfirmDialog from "../components/ConfirmDialog";
import api from "../api/axios";
import { bookingStatusColors, paymentStatusColors, STRIPE_PUBLISHABLE_KEY } from "../utils/constants";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

function PaymentForm({ bookingId, amount, onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    try {
      const { data } = await api.post("/payments/create-intent", { bookingId });

      const { error, paymentIntent } = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: { card: elements.getElement(CardElement) },
      });

      if (error) {
        toast.error(error.message);
      } else if (paymentIntent.status === "succeeded") {
        await api.post("/payments/confirm", { paymentIntentId: paymentIntent.id });
        toast.success("Payment successful!");
        onSuccess();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Payment failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      <div className="p-4 border border-gray-200 rounded-xl bg-gray-50">
        <CardElement
          options={{
            style: {
              base: { fontSize: "16px", color: "#374151", "::placeholder": { color: "#9CA3AF" } },
            },
          }}
        />
      </div>
      <div className="flex gap-3 mt-4">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl font-medium text-gray-600 hover:bg-gray-50 transition-all duration-200">
          Cancel
        </button>
        <button type="submit" disabled={!stripe || processing} className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all duration-200">
          {processing ? "Processing..." : `Pay $${amount}`}
        </button>
      </div>
    </form>
  );
}

const STATUS_FLOW = ["pending", "accepted", "ongoing", "completed"];

function StatusTimeline({ status }) {
  const currentIndex = STATUS_FLOW.indexOf(status);
  const isCancelled = status === "cancelled" || status === "rejected";

  return (
    <div className="flex items-center justify-between">
      {STATUS_FLOW.map((step, i) => {
        const done = !isCancelled && i < currentIndex;
        const active = !isCancelled && i === currentIndex;
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  done
                    ? "bg-green-500 text-white"
                    : active
                    ? "bg-blue-600 text-white ring-4 ring-blue-100 animate-pulse-soft"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <span className={`text-xs mt-1.5 capitalize ${active || done ? "font-semibold text-gray-700" : "text-gray-400"}`}>
                {step}
              </span>
            </div>
            {i < STATUS_FLOW.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 -mt-5 transition-all duration-500 ${done ? "bg-green-500" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [existingReview, setExistingReview] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [showReview, setShowReview] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchBooking = async () => {
      try {
        const { data } = await api.get(`/bookings/${id}`);
        if (!active) return;
        setBooking(data.booking);

        if (data.booking.status === "completed" && role === "user") {
          try {
            const { data: reviewData } = await api.get(`/reviews/booking/${id}`);
            if (active) setExistingReview(reviewData.review);
          } catch {
            // review lookup is optional
          }
        }
      } catch {
        if (active) toast.error("Failed to load booking");
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchBooking();
    return () => {
      active = false;
    };
  }, [id, role]);

  const handleStatusUpdate = async (status) => {
    if (status === "cancelled") {
      setConfirmCancel(true);
      return;
    }
    try {
      const { data } = await api.put(`/bookings/${id}/status`, { status });
      setBooking(data.booking);
      toast.success(`Booking ${status}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update");
    }
  };

  const handleConfirmCancel = async () => {
    setCancelling(true);
    try {
      const { data } = await api.put(`/bookings/${id}/status`, { status: "cancelled" });
      setBooking(data.booking);
      toast.success("Booking cancelled");
      setConfirmCancel(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to cancel");
    } finally {
      setCancelling(false);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPayment(false);
    setBooking((prev) => ({ ...prev, paymentStatus: "paid" }));
  };

  const handleReview = async (e) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      const { data } = await api.post("/reviews", {
        bookingId: id,
        driverId: booking.driver._id,
        ...reviewForm,
      });
      toast.success("Review submitted!");
      setExistingReview(data.review);
      setShowReview(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Review failed");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!booking) return <p className="text-center py-20 text-gray-500">Booking not found.</p>;

  const canReview =
    role === "user" &&
    booking.status === "completed" &&
    booking.paymentStatus === "paid" &&
    !existingReview;

  const backTo = role === "driver" ? "/driver/bookings" : "/bookings";

  return (
    <div className="max-w-3xl mx-auto">
      <BackButton to={backTo} label="Back to Bookings" />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-extrabold text-gray-900">Booking Details</h1>
        <div className="flex items-center gap-2">
          <span className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize ${bookingStatusColors[booking.status]}`}>
            {booking.status}
          </span>
          <span className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize ${paymentStatusColors[booking.paymentStatus]}`}>
            {booking.paymentStatus}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 animate-scale-in">
        <div className="mb-8">
          <StatusTimeline status={booking.status} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Detail icon={<HiUser />} label={role === "driver" ? "Customer" : "Driver"} value={role === "driver" ? booking.user?.name : booking.driver?.name} />
          <Detail icon={<HiCalendar />} label="Hire Type" value={booking.hireType === "temporary" ? "Temporary" : "Permanent"} />
          <Detail icon={<HiCalendar />} label="Start Date" value={new Date(booking.startDate).toLocaleDateString()} />
          {booking.endDate && <Detail icon={<HiCalendar />} label="End Date" value={new Date(booking.endDate).toLocaleDateString()} />}
          <Detail icon={<HiLocationMarker />} label="Pickup" value={booking.pickupLocation} />
          {booking.dropLocation && <Detail icon={<HiLocationMarker />} label="Drop" value={booking.dropLocation} />}
          <Detail icon={<HiCash />} label="Total Amount" value={`$${booking.totalAmount}`} />
          {booking.cancellationReason && (
            <Detail icon={<HiCash />} label="Cancel Reason" value={booking.cancellationReason} />
          )}
        </div>

        {booking.purpose && (
          <div className="mt-5 p-4 bg-gray-50 rounded-xl">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Purpose</p>
            <p className="text-sm text-gray-700">{booking.purpose}</p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          {role === "driver" && booking.status === "pending" && (
            <>
              <button onClick={() => handleStatusUpdate("accepted")} className="px-5 py-2.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-all duration-200">
                Accept
              </button>
              <button onClick={() => handleStatusUpdate("rejected")} className="px-5 py-2.5 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-all duration-200">
                Reject
              </button>
            </>
          )}
          {role === "driver" && booking.status === "accepted" && (
            <button onClick={() => handleStatusUpdate("ongoing")} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all duration-200">
              Start Trip
            </button>
          )}
          {role === "driver" && booking.status === "ongoing" && (
            <button onClick={() => handleStatusUpdate("completed")} className="px-5 py-2.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-all duration-200">
              Complete Trip
            </button>
          )}
          {(role === "user" || role === "driver") && (booking.status === "pending" || booking.status === "accepted") && (
            <button onClick={() => handleStatusUpdate("cancelled")} className="px-5 py-2.5 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-all duration-200">
              Cancel Booking
            </button>
          )}
          {role === "user" && booking.status === "accepted" && booking.paymentStatus === "pending" && (
            <button onClick={() => setShowPayment(true)} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all duration-200">
              Pay ${booking.totalAmount}
            </button>
          )}
          {canReview && !showReview && (
            <button onClick={() => setShowReview(true)} className="px-5 py-2.5 bg-yellow-500 text-white rounded-xl font-semibold hover:bg-yellow-600 transition-all duration-200">
              Write Review
            </button>
          )}
          {(role === "user" || role === "driver") && (
            <button
              onClick={() => {
                const recipientId = role === "user" ? booking.driver?._id : booking.user?._id;
                if (!recipientId) return;
                api
                  .post("/messages/conversations", { recipientId })
                  .then(({ data }) => navigate(`/messages/${data.conversation._id}`))
                  .catch((err) => toast.error(err.response?.data?.message || "Could not start conversation"));
              }}
              className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all duration-200"
            >
              Message
            </button>
          )}
        </div>

        {showPayment && (
          <Elements stripe={stripePromise}>
            <PaymentForm
              bookingId={id}
              amount={booking.totalAmount}
              onSuccess={handlePaymentSuccess}
              onCancel={() => setShowPayment(false)}
            />
          </Elements>
        )}
      </div>

      {existingReview && !showReview && (
        <div className="mt-6 bg-white rounded-2xl border border-gray-100 p-6 animate-fade-up">
          <div className="flex items-center gap-2 mb-3">
            <HiCheckCircle className="w-5 h-5 text-green-500" />
            <h3 className="font-bold text-gray-900">Your Review</h3>
          </div>
          <div className="flex items-center gap-1 mb-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <HiStar key={i} className={`w-5 h-5 ${i < existingReview.rating ? "text-yellow-500" : "text-gray-200"}`} />
            ))}
          </div>
          {existingReview.comment && <p className="text-gray-600 text-sm leading-relaxed">{existingReview.comment}</p>}
        </div>
      )}

      {showReview && (
        <form onSubmit={handleReview} className="mt-6 bg-white rounded-2xl border border-gray-100 p-6 animate-fade-up">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Rate Your Experience</h3>
          <div className="flex items-center gap-1 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} type="button" onClick={() => setReviewForm({ ...reviewForm, rating: star })}>
                <HiStar className={`w-8 h-8 transition-colors ${star <= reviewForm.rating ? "text-yellow-500" : "text-gray-300"}`} />
              </button>
            ))}
          </div>
          <textarea
            value={reviewForm.comment}
            onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
            placeholder="Share your experience..."
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 outline-none resize-none transition-all duration-200"
          />
          <div className="flex gap-3 mt-3">
            <button type="button" onClick={() => setShowReview(false)} className="px-4 py-2 border border-gray-200 rounded-xl font-medium text-gray-600 hover:bg-gray-50 transition-all duration-200">Cancel</button>
            <button type="submit" disabled={submittingReview} className="px-4 py-2 bg-yellow-500 text-white rounded-xl font-semibold hover:bg-yellow-600 disabled:opacity-50 transition-all duration-200">
              {submittingReview ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel Booking"
        message="Are you sure you want to cancel this booking? This action cannot be undone."
        confirmLabel="Yes, Cancel"
        variant="danger"
        loading={cancelling}
        onConfirm={handleConfirmCancel}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
}

function Detail({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-8 h-8 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-medium text-gray-900 truncate">{value}</p>
      </div>
    </div>
  );
}
