import { jest } from "@jest/globals";
import crypto from "crypto";

const mockOrdersCreate = jest.fn();
const mockPaymentsRefund = jest.fn();

jest.unstable_mockModule("razorpay", () => ({
  default: jest.fn().mockImplementation(() => ({
    orders: { create: mockOrdersCreate },
    payments: { refund: mockPaymentsRefund },
  })),
}));

jest.unstable_mockModule("../kafka/index.js", () => ({
  publishKafkaEvent: jest.fn().mockResolvedValue(undefined),
  KAFKA_TOPICS: { PAYMENT_COMPLETED: "mymate.payment.completed" },
}));

jest.unstable_mockModule("../config/email.js", () => ({
  sendBookingStatusUpdate: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../models/Notification.js", () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
}));

// Dynamic imports
const {
  createOrder,
  verifyPayment,
  getPaymentStatus,
  refundPayment,
  payWithWallet,
  handleWebhook,
} = await import("../controllers/paymentController.js");

const Booking = (await import("../models/Booking.js")).default;
const Payment = (await import("../models/Payment.js")).default;
const Driver = (await import("../models/Driver.js")).default;
const User = (await import("../models/User.js")).default;
const WalletTransaction = (await import("../models/WalletTransaction.js")).default;

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    body: undefined as any,
  };
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((data: any) => {
    res.body = data;
    return res;
  });
  return res;
}

describe("Payment Processing Test Suite (TASK 2.3)", () => {
  const validBookingId = "507f1f77bcf86cd799439001";
  const validUserId = "507f1f77bcf86cd799439011";
  const validDriverId = "507f191e810c19729de860ea";
  const razorpaySecret = "test_razorpay_secret_key_123";

  beforeAll(() => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_key_id";
    process.env.RAZORPAY_KEY_SECRET = razorpaySecret;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("1. Razorpay Order Creation (createOrder)", () => {
    it("should reject order creation if booking is not found", async () => {
      jest.spyOn(Booking, "findById").mockResolvedValue(null);

      const req: any = {
        user: { _id: validUserId },
        body: { bookingId: validBookingId },
      };
      const res = createMockResponse();

      await createOrder(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Booking not found");
    });

    it("should reject order creation if user is unauthorized", async () => {
      const booking = {
        _id: validBookingId,
        user: "507f1f77bcf86cd799439999", // Different user
        status: "accepted",
      };
      jest.spyOn(Booking, "findById").mockResolvedValue(booking as any);

      const req: any = {
        user: { _id: validUserId },
        body: { bookingId: validBookingId },
      };
      const res = createMockResponse();

      await createOrder(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toBe("Not authorized");
    });

    it("should reject order creation if booking is not accepted yet (e.g. pending)", async () => {
      const booking = {
        _id: validBookingId,
        user: validUserId,
        status: "pending",
        paymentStatus: "pending",
        totalAmount: 500,
      };
      jest.spyOn(Booking, "findById").mockResolvedValue(booking as any);

      const req: any = {
        user: { _id: validUserId },
        body: { bookingId: validBookingId },
      };
      const res = createMockResponse();

      await createOrder(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Booking must be accepted before payment");
    });

    it("should reject order creation if booking is already paid", async () => {
      const booking = {
        _id: validBookingId,
        user: validUserId,
        status: "accepted",
        paymentStatus: "paid",
        totalAmount: 500,
      };
      jest.spyOn(Booking, "findById").mockResolvedValue(booking as any);

      const req: any = {
        user: { _id: validUserId },
        body: { bookingId: validBookingId },
      };
      const res = createMockResponse();

      await createOrder(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("This booking is already paid");
    });

    it("should successfully create Razorpay order and pending payment record", async () => {
      const booking = {
        _id: validBookingId,
        user: validUserId,
        driver: validDriverId,
        status: "accepted",
        paymentStatus: "pending",
        totalAmount: 500,
      };
      jest.spyOn(Booking, "findById").mockResolvedValue(booking as any);

      mockOrdersCreate.mockResolvedValueOnce({
        id: "order_rzp_mock_123",
        amount: 50000,
        currency: "INR",
      });

      const findOneAndUpdateSpy = jest
        .spyOn(Payment, "findOneAndUpdate")
        .mockResolvedValue({} as any);

      const req: any = {
        user: { _id: validUserId },
        body: { bookingId: validBookingId },
      };
      const res = createMockResponse();

      await createOrder(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.orderId).toBe("order_rzp_mock_123");
      expect(res.body.amount).toBe(50000);
      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        { booking: validBookingId, status: "pending" },
        expect.objectContaining({
          booking: validBookingId,
          user: validUserId,
          driver: validDriverId,
          amount: 500,
          razorpayOrderId: "order_rzp_mock_123",
          status: "pending",
        }),
        { upsert: true, setDefaultsOnInsert: true }
      );
    });

    it("should return 502 if Razorpay gateway order creation fails", async () => {
      const booking = {
        _id: validBookingId,
        user: validUserId,
        status: "accepted",
        paymentStatus: "pending",
        totalAmount: 500,
      };
      jest.spyOn(Booking, "findById").mockResolvedValue(booking as any);
      mockOrdersCreate.mockRejectedValueOnce(new Error("Gateway connection timeout"));

      const req: any = {
        user: { _id: validUserId },
        body: { bookingId: validBookingId },
      };
      const res = createMockResponse();

      await createOrder(req, res);

      expect(res.statusCode).toBe(502);
      expect(res.body.message).toContain("Could not create payment order");
    });
  });

  describe("2. Payment Signature Verification (verifyPayment)", () => {
    it("should reject if payment document is not found", async () => {
      jest.spyOn(Payment, "findOne").mockResolvedValue(null);

      const req: any = {
        user: { _id: validUserId },
        body: {
          razorpay_order_id: "order_not_found",
          razorpay_payment_id: "pay_123",
          razorpay_signature: "sig_123",
        },
      };
      const res = createMockResponse();

      await verifyPayment(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Order not found");
    });

    it("should reject verification on signature mismatch and set status to failed", async () => {
      const paymentDoc = {
        _id: "pay_doc_001",
        user: validUserId,
        status: "pending",
        razorpayOrderId: "order_test_999",
      };
      jest.spyOn(Payment, "findOne").mockResolvedValue(paymentDoc as any);
      const updateOneSpy = jest.spyOn(Payment, "updateOne").mockResolvedValue({} as any);

      const req: any = {
        user: { _id: validUserId },
        body: {
          razorpay_order_id: "order_test_999",
          razorpay_payment_id: "pay_test_888",
          razorpay_signature: "invalid_forged_signature_hex",
        },
      };
      const res = createMockResponse();

      await verifyPayment(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Payment signature verification failed");
      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: "pay_doc_001", status: "pending" },
        { $set: { status: "failed" } }
      );
    });

    it("should verify payment successfully when signature is valid and credit driver wallet", async () => {
      const orderId = "order_valid_111";
      const paymentId = "pay_valid_222";
      const validSig = crypto
        .createHmac("sha256", razorpaySecret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      const paymentDoc = {
        _id: "pay_doc_002",
        user: validUserId,
        driver: validDriverId,
        booking: validBookingId,
        status: "pending",
        razorpayOrderId: orderId,
      };
      jest.spyOn(Payment, "findOne").mockResolvedValue(paymentDoc as any);

      const updatedPayment = {
        ...paymentDoc,
        status: "completed",
        razorpayPaymentId: paymentId,
        razorpaySignature: validSig,
      };
      jest.spyOn(Payment, "findOneAndUpdate").mockResolvedValue(updatedPayment as any);

      const bookingDoc: any = {
        _id: validBookingId,
        user: validUserId,
        driver: validDriverId,
        totalAmount: 1000,
        paymentStatus: "pending",
        save: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(Booking, "findById").mockResolvedValue(bookingDoc);

      const driverUpdateSpy = jest
        .spyOn(Driver, "findByIdAndUpdate")
        .mockResolvedValue({} as any);
      const walletTxnSpy = jest
        .spyOn(WalletTransaction, "create")
        .mockResolvedValue({} as any);

      const selectMock = jest.fn().mockResolvedValue({ name: "Bob", email: "bob@test.com" });
      jest.spyOn(Driver, "findById").mockReturnValue({ select: selectMock } as any);
      jest.spyOn(User, "findById").mockReturnValue({ select: selectMock } as any);

      const req: any = {
        user: { _id: validUserId },
        body: {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSig,
        },
      };
      const res = createMockResponse();

      await verifyPayment(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Payment verified successfully");
      expect(bookingDoc.paymentStatus).toBe("paid");
      expect(bookingDoc.save).toHaveBeenCalled();
      // 90% of ₹1000 = ₹900 to driver
      expect(driverUpdateSpy).toHaveBeenCalledWith(validDriverId, {
        $inc: { walletBalance: 900 },
      });
      expect(walletTxnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          driver: validDriverId,
          type: "credit",
          amount: 900,
        })
      );
    });
  });

  describe("3. Idempotent Double-Verify Race Condition (line ~113-138)", () => {
    it("should handle pre-verified payment idempotently", async () => {
      const alreadyCompletedPayment = {
        _id: "pay_already_completed",
        user: validUserId,
        status: "completed",
        razorpayOrderId: "order_completed_123",
      };
      jest.spyOn(Payment, "findOne").mockResolvedValue(alreadyCompletedPayment as any);

      const req: any = {
        user: { _id: validUserId },
        body: {
          razorpay_order_id: "order_completed_123",
          razorpay_payment_id: "pay_completed_456",
          razorpay_signature: "some_signature",
        },
      };
      const res = createMockResponse();

      await verifyPayment(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Payment already verified");
    });

    it("should prevent double-crediting if concurrent request completed transition first", async () => {
      const orderId = "order_race_123";
      const paymentId = "pay_race_456";
      const validSig = crypto
        .createHmac("sha256", razorpaySecret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      const paymentDoc = {
        _id: "pay_doc_race",
        user: validUserId,
        status: "pending", // Initially checked as pending
        razorpayOrderId: orderId,
      };
      jest.spyOn(Payment, "findOne").mockResolvedValue(paymentDoc as any);

      // Concurrent request won the race: atomic findOneAndUpdate returns null
      // because status is no longer 'pending'
      jest.spyOn(Payment, "findOneAndUpdate").mockResolvedValue(null);

      const driverUpdateSpy = jest.spyOn(Driver, "findByIdAndUpdate");
      const walletTxnSpy = jest.spyOn(WalletTransaction, "create");

      const req: any = {
        user: { _id: validUserId },
        body: {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSig,
        },
      };
      const res = createMockResponse();

      await verifyPayment(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Payment already verified");
      // Must NOT credit driver wallet twice!
      expect(driverUpdateSpy).not.toHaveBeenCalled();
      expect(walletTxnSpy).not.toHaveBeenCalled();
    });
  });

  describe("4. Wallet Payment Flow (payWithWallet)", () => {
    it("should reject wallet payment if balance is insufficient", async () => {
      const booking = {
        _id: validBookingId,
        user: validUserId,
        driver: validDriverId,
        totalAmount: 500,
        status: "accepted",
        paymentStatus: "pending",
      };
      jest.spyOn(Booking, "findById").mockResolvedValue(booking as any);
      // Atomic findOneAndUpdate returns null when walletBalance < totalAmount
      jest.spyOn(User, "findOneAndUpdate").mockResolvedValue(null);

      const req: any = {
        user: { _id: validUserId },
        body: { bookingId: validBookingId },
      };
      const res = createMockResponse();

      await payWithWallet(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Insufficient wallet balance");
    });

    it("should successfully debit user and credit driver on wallet payment", async () => {
      const bookingDoc: any = {
        _id: validBookingId,
        user: validUserId,
        driver: validDriverId,
        totalAmount: 500,
        status: "accepted",
        paymentStatus: "pending",
        save: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(Booking, "findById").mockResolvedValue(bookingDoc);

      const updatedUser = {
        _id: validUserId,
        walletBalance: 1500,
      };
      jest.spyOn(User, "findOneAndUpdate").mockResolvedValue(updatedUser as any);
      jest.spyOn(Driver, "findByIdAndUpdate").mockResolvedValue({} as any);
      jest.spyOn(WalletTransaction, "create").mockResolvedValue({} as any);

      const selectMock = jest.fn().mockResolvedValue({ name: "Bob", email: "bob@driver.com" });
      jest.spyOn(Driver, "findById").mockReturnValue({ select: selectMock } as any);

      const req: any = {
        user: { _id: validUserId },
        body: { bookingId: validBookingId },
      };
      const res = createMockResponse();

      await payWithWallet(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Payment successful using wallet");
      expect(bookingDoc.paymentStatus).toBe("paid");
    });
  });

  describe("5. Payment Status & Refund (getPaymentStatus & refundPayment)", () => {
    it("getPaymentStatus should return booking payment status", async () => {
      const booking = {
        _id: validBookingId,
        user: validUserId,
        driver: validDriverId,
        paymentStatus: "paid",
      };
      jest.spyOn(Booking, "findById").mockResolvedValue(booking as any);
      jest.spyOn(Payment, "findOne").mockResolvedValue({ status: "completed" } as any);

      const req: any = {
        user: { _id: validUserId },
        userRole: "user",
        params: { bookingId: validBookingId },
      };
      const res = createMockResponse();

      await getPaymentStatus(req, res);

      expect(res.body.paymentStatus).toBe("paid");
      expect(res.body.payment.status).toBe("completed");
    });

    it("refundPayment should process refund through Razorpay and update statuses", async () => {
      const bookingDoc: any = {
        _id: validBookingId,
        paymentStatus: "paid",
        save: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(Booking, "findById").mockResolvedValue(bookingDoc);

      const paymentDoc: any = {
        _id: "pay_refund_111",
        booking: validBookingId,
        status: "completed",
        amount: 500,
        razorpayPaymentId: "pay_rzp_999",
        save: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(Payment, "findOne").mockResolvedValue(paymentDoc);
      mockPaymentsRefund.mockResolvedValueOnce({ id: "rfnd_mock_123" });

      const req: any = {
        user: { _id: validUserId },
        body: { bookingId: validBookingId },
      };
      const res = createMockResponse();

      await refundPayment(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Refund processed successfully");
      expect(paymentDoc.status).toBe("refunded");
      expect(bookingDoc.paymentStatus).toBe("refunded");
    });
  });

  describe("6. Razorpay Webhook Endpoint (POST /api/v1/payments/webhook - TASK 2.5)", () => {
    it("should reject webhook request missing X-Razorpay-Signature header", async () => {
      const req: any = {
        headers: {},
        body: { event: "payment.captured" },
      };
      const res = createMockResponse();

      await handleWebhook(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Missing Razorpay signature header");
    });

    it("should reject webhook request with invalid signature", async () => {
      const req: any = {
        headers: { "x-razorpay-signature": "tampered_signature_hex" },
        body: { event: "payment.captured" },
      };
      const res = createMockResponse();

      await handleWebhook(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Invalid webhook signature");
    });

    it("should reconcile payment and mark booking paid even if client never calls verifyPayment", async () => {
      const orderId = "order_webhook_reconcile_123";
      const paymentId = "pay_webhook_captured_456";

      const payload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: orderId,
              amount: 100000,
              currency: "INR",
              status: "captured",
            },
          },
        },
      };

      const rawPayload = JSON.stringify(payload);
      const validSignature = crypto
        .createHmac("sha256", razorpaySecret)
        .update(rawPayload)
        .digest("hex");

      const paymentDoc = {
        _id: "pay_doc_webhook_reconcile",
        user: validUserId,
        driver: validDriverId,
        booking: validBookingId,
        amount: 1000,
        status: "pending",
        razorpayOrderId: orderId,
      };

      jest.spyOn(Payment, "findOne").mockResolvedValue(paymentDoc as any);

      const updatedPaymentDoc = {
        ...paymentDoc,
        status: "completed",
        razorpayPaymentId: paymentId,
      };
      jest.spyOn(Payment, "findOneAndUpdate").mockResolvedValue(updatedPaymentDoc as any);

      const bookingDoc: any = {
        _id: validBookingId,
        user: validUserId,
        driver: validDriverId,
        totalAmount: 1000,
        paymentStatus: "pending", // Still pending because client NEVER called verifyPayment
        save: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(Booking, "findById").mockResolvedValue(bookingDoc);

      const driverUpdateSpy = jest
        .spyOn(Driver, "findByIdAndUpdate")
        .mockResolvedValue({} as any);
      const walletTxnSpy = jest
        .spyOn(WalletTransaction, "create")
        .mockResolvedValue({} as any);

      const selectMock = jest.fn().mockResolvedValue({ name: "Bob", email: "bob@driver.com" });
      jest.spyOn(Driver, "findById").mockReturnValue({ select: selectMock } as any);
      jest.spyOn(User, "findById").mockReturnValue({ select: selectMock } as any);

      const req: any = {
        headers: { "x-razorpay-signature": validSignature },
        body: payload,
      };
      const res = createMockResponse();

      await handleWebhook(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.message).toBe("Payment reconciled successfully");

      // Booking is now marked paid server-side!
      expect(bookingDoc.paymentStatus).toBe("paid");
      expect(bookingDoc.save).toHaveBeenCalled();

      // Driver wallet is credited with 90% (₹900)
      expect(driverUpdateSpy).toHaveBeenCalledWith(validDriverId, {
        $inc: { walletBalance: 900 },
      });
      expect(walletTxnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          driver: validDriverId,
          type: "credit",
          amount: 900,
          description: expect.stringContaining("via webhook reconciliation"),
        })
      );
    });

    it("should handle already completed payments idempotently without double-crediting", async () => {
      const orderId = "order_already_completed";
      const payload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_xyz",
              order_id: orderId,
            },
          },
        },
      };

      const rawPayload = JSON.stringify(payload);
      const validSignature = crypto
        .createHmac("sha256", razorpaySecret)
        .update(rawPayload)
        .digest("hex");

      const alreadyCompletedPayment = {
        _id: "pay_doc_completed",
        status: "completed",
        razorpayOrderId: orderId,
      };
      jest.spyOn(Payment, "findOne").mockResolvedValue(alreadyCompletedPayment as any);

      const driverUpdateSpy = jest.spyOn(Driver, "findByIdAndUpdate");

      const req: any = {
        headers: { "x-razorpay-signature": validSignature },
        body: payload,
      };
      const res = createMockResponse();

      await handleWebhook(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Already reconciled");
      expect(driverUpdateSpy).not.toHaveBeenCalled();
    });
  });
});
