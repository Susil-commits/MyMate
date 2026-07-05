import Stripe from "stripe";
import Payment from "../models/Payment.js";
import Booking from "../models/Booking.js";
import logger from "../config/logger.js";

let stripeClient;
const getStripe = () => {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || "");
  }
  return stripeClient;
};

export const handleWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    logger.warn("Stripe webhook received without signature or secret");
    return res.status(400).json({ message: "Webhook not configured" });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    logger.error("Webhook signature verification failed", { error: err.message });
    return res.status(400).json({ message: "Webhook signature verification failed" });
  }

  logger.info("Stripe webhook received", { type: event.type });

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const payment = await Payment.findOne({ paymentIntentId: paymentIntent.id });

        if (payment && payment.status !== "completed") {
          payment.status = "completed";
          payment.paidAt = new Date();
          await payment.save();

          await Booking.findByIdAndUpdate(payment.booking, { paymentStatus: "paid" });
          logger.info("Payment completed via webhook", { paymentId: payment._id, bookingId: payment.booking });
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        const payment = await Payment.findOne({ paymentIntentId: paymentIntent.id });

        if (payment && payment.status === "pending") {
          payment.status = "failed";
          await payment.save();
          logger.warn("Payment failed via webhook", { paymentId: payment._id });
        }
        break;
      }

      default:
        logger.debug("Unhandled webhook event", { type: event.type });
    }
  } catch (error) {
    logger.error("Webhook handler error", { error: error.message, type: event.type });
  }

  res.json({ received: true });
};