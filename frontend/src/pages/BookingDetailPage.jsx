import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { HiStar } from "react-icons/hi";
import BackButton from "../components/BackButton";
import ConfirmDialog from "../components/ConfirmDialog";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
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
    <form onSubmit={handleSubmit} className="mt-4">
      <div className="p-4 border border-gray-300 rounded-lg">
        <CardElement
          options={{
            style: {
              base: { fontSize: "16px", color: "#374151", "::placeholder": { color: "#9CA3AF" } },
            },
          }}
        />
      </div>
      <div className="flex gap-3 mt-4">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" disabled={!stripe || processing} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50">
          {processing ? "Processing..." : `Pay $${amount}`}
        </button>
      </div>
    </form>
  );
}

export default function BookingDetailPage() {
  const { id } = useParams();
  const { role } = useAuth();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [showReview, setShowReview] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const { data } = await api.get(`/bookings/${id}`);
        setBooking(data.booking);
      } catch {
        toast.error("Failed to load booking");
      } finally {
        setLoading(false);
      }
    };
    fetchBooking();
  }, [id]);

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
      await api.post("/reviews", {
        bookingId: id,
        driverId: booking.driver._id,
        ...reviewForm,
      });
      toast.success("Review submitted!");
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
    booking.paymentStatus === "paid";

  return (
    <div className="max-w-3xl mx-auto">
      <BackButton to="/bookings" label="Back to Bookings" />
      <h1 className="text-3xl font-bold text-gray-900">Booking Details</h1>

      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-between mb-6">
          <span className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize ${bookingStatusColors[booking.status]}`}>
            {booking.status}
          </span>
          <span className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize ${paymentStatusColors[booking.paymentStatus]}`}>
            {booking.paymentStatus}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <Detail label="Driver" value={booking.driver?.name} />
          <Detail label="Hire Type" value={booking.hireType === "temporary" ? "Temporary" : "Permanent"} />
          <Detail label="Start Date" value={new Date(booking.startDate).toLocaleDateString()} />
          {booking.endDate && <Detail label="End Date" value={new Date(booking.endDate).toLocaleDateString()} />}
          <Detail label="Pickup" value={booking.pickupLocation} />
          {booking.dropLocation && <Detail label="Drop" value={booking.dropLocation} />}
          <Detail label="Purpose" value={booking.purpose} />
          <Detail label="Total Amount" value={`$${booking.totalAmount}`} />
          <Detail label="Payment" value={booking.paymentStatus} />
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {role === "driver" && booking.status === "pending" && (
            <>
              <button onClick={() => handleStatusUpdate("accepted")} className="px-5 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700">
                Accept
              </button>
              <button onClick={() => handleStatusUpdate("rejected")} className="px-5 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700">
                Reject
              </button>
            </>
          )}
          {role === "driver" && booking.status === "accepted" && (
            <button onClick={() => handleStatusUpdate("ongoing")} className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
              Start Trip
            </button>
          )}
          {role === "driver" && booking.status === "ongoing" && (
            <button onClick={() => handleStatusUpdate("completed")} className="px-5 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700">
              Complete Trip
            </button>
          )}
          {(role === "user" || role === "driver") && (booking.status === "pending" || booking.status === "accepted") && (
            <button onClick={() => handleStatusUpdate("cancelled")} className="px-5 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600">
              Cancel Booking
            </button>
          )}
          {role === "user" && booking.status === "accepted" && booking.paymentStatus === "pending" && (
            <button onClick={() => setShowPayment(true)} className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700">
              Pay ${booking.totalAmount}
            </button>
          )}
          {canReview && !showReview && (
            <button onClick={() => setShowReview(true)} className="px-5 py-2 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700">
              Write Review
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

        {showReview && (
          <form onSubmit={handleReview} className="mt-6 border-t pt-6">
            <h3 className="text-lg font-semibold mb-3">Rate Your Experience</h3>
            <div className="flex items-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                >
                  <HiStar
                    className={`w-8 h-8 ${star <= reviewForm.rating ? "text-yellow-500" : "text-gray-300"}`}
                  />
                </button>
              ))}
            </div>
            <textarea
              value={reviewForm.comment}
              onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
              placeholder="Share your experience..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none resize-none"
            />
            <div className="flex gap-3 mt-3">
              <button type="button" onClick={() => setShowReview(false)} className="px-4 py-2 border border-gray-300 rounded-lg">Cancel</button>
              <button type="submit" disabled={submittingReview} className="px-4 py-2 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 disabled:opacity-50">
                {submittingReview ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          </form>
        )}
      </div>

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

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="font-medium text-gray-900 capitalize">{value}</p>
    </div>
  );
}