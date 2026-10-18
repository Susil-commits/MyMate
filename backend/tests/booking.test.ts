import { jest } from "@jest/globals";

// Mock external side-effects
jest.unstable_mockModule("../kafka/index.js", () => ({
  publishKafkaEvent: jest.fn().mockResolvedValue(undefined),
  KAFKA_TOPICS: {
    BOOKING_CREATED: "mymate.booking.created",
    BOOKING_STATUS_CHANGED: "mymate.booking.status_changed",
  },
}));

jest.unstable_mockModule("../utils/pricingEngine.js", () => ({
  calculateDynamicSurge: jest.fn().mockResolvedValue(1.0),
}));

jest.unstable_mockModule("../config/email.js", () => ({
  sendBookingConfirmation: jest.fn().mockResolvedValue(undefined),
  sendBookingStatusUpdate: jest.fn().mockResolvedValue(undefined),
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../utils/socket.js", () => ({
  getIo: jest.fn().mockReturnValue({
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  }),
}));

jest.unstable_mockModule("../models/Notification.js", () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("ics", () => ({
  createEvent: jest.fn((event: any, cb: any) => {
    cb(null, "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:MyMate\nEND:VCALENDAR");
  }),
}));

const mockRefund = jest.fn().mockResolvedValue({ id: "rfnd_123", status: "processed" });
jest.unstable_mockModule("razorpay", () => ({
  default: jest.fn().mockImplementation(() => ({
    payments: {
      refund: mockRefund,
    },
  })),
}));

// Dynamic imports
const {
  createBooking,
  updateBookingStatus,
  getUserBookings,
  getDriverBookings,
  getDriverStats,
  getBookingById,
  downloadCalendar,
  downloadInvoice,
} = await import("../controllers/bookingController.js");

const Booking = (await import("../models/Booking.js")).default;
const Driver = (await import("../models/Driver.js")).default;
const PromoCode = (await import("../models/PromoCode.js")).default;
const Payment = (await import("../models/Payment.js")).default;
const WalletTransaction = (await import("../models/WalletTransaction.js")).default;

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as any,
    sentData: undefined as any,
  };
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((data: any) => {
    res.body = data;
    return res;
  });
  res.setHeader = jest.fn((key: string, val: string) => {
    res.headers[key] = val;
    return res;
  });
  res.send = jest.fn((data: any) => {
    res.sentData = data;
    return res;
  });
  res.on = jest.fn();
  res.once = jest.fn();
  res.emit = jest.fn();
  res.write = jest.fn();
  res.end = jest.fn();
  return res;
}

function mockFindByIdDoc(doc: any) {
  doc.save = doc.save || jest.fn().mockImplementation(async function (this: any) {
    return this;
  });
  doc.populate = jest.fn().mockImplementation(() => doc);
  return doc;
}

describe("Booking Management Test Suite (TASK 2.2)", () => {
  const validDriverId = "507f191e810c19729de860ea";
  const validUserId = "507f1f77bcf86cd799439011";

  beforeAll(() => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_key_123";
    process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret_456";
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("1. Duplicate Active Booking Guard (lines ~42-50)", () => {
    it("should reject booking creation if driver is not active or KYC is not approved", async () => {
      jest.spyOn(Driver, "findById").mockResolvedValue({
        _id: validDriverId,
        kycStatus: "pending",
        isActive: true,
      } as any);

      const req: any = {
        user: { _id: validUserId },
        body: {
          driverId: validDriverId,
          hireType: "temporary",
          startDate: new Date(Date.now() + 86400000).toISOString(),
          pickupLocation: "Airport Terminal 3",
          purpose: "Airport pickup",
        },
      };
      const res = createMockResponse();

      await createBooking(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain("not available for booking");
    });

    it("should prevent duplicate active bookings between the same user and driver", async () => {
      jest.spyOn(Driver, "findById").mockResolvedValue({
        _id: validDriverId,
        kycStatus: "approved",
        isActive: true,
        hourlyRate: 150,
      } as any);

      const existingBooking = {
        _id: "507f1f77bcf86cd799439099",
        user: validUserId,
        driver: validDriverId,
        status: "accepted",
      };
      jest.spyOn(Booking, "findOne").mockResolvedValue(existingBooking as any);

      const req: any = {
        user: { _id: validUserId },
        body: {
          driverId: validDriverId,
          hireType: "temporary",
          startDate: new Date(Date.now() + 86400000).toISOString(),
          pickupLocation: "Connaught Place",
          purpose: "City tour",
        },
      };
      const res = createMockResponse();

      await createBooking(req, res);

      expect(res.statusCode).toBe(409);
      expect(res.body.message).toBe("You already have an active booking with this driver");
      expect(res.body.bookingId).toBe("507f1f77bcf86cd799439099");
    });
  });

  describe("2. Promo Code Atomic Usage-Limit Increment Under Concurrent Requests", () => {
    it("should atomically honor promo usageLimit across concurrent booking requests", async () => {
      const driverMock = {
        _id: validDriverId,
        kycStatus: "approved",
        isActive: true,
        hourlyRate: 100,
      };
      jest.spyOn(Driver, "findById").mockResolvedValue(driverMock as any);
      jest.spyOn(Booking, "findOne").mockResolvedValue(null);

      jest.spyOn(Booking, "create").mockImplementation(async (data: any) => ({
        _id: `booking_${Math.random()}`,
        ...data,
      }));

      // Simulate atomic database counter with usageLimit = 2
      let atomicCounter = 0;
      const usageLimit = 2;

      jest.spyOn(PromoCode, "findOneAndUpdate").mockImplementation(async (query: any) => {
        if (atomicCounter < usageLimit) {
          atomicCounter++;
          return {
            code: "FLASH50",
            discountPercentage: 50,
            maxDiscount: 200,
            usedCount: atomicCounter,
            usageLimit,
          } as any;
        }
        return null;
      });

      const startDate = new Date(Date.now() + 86400000).toISOString();
      const endDate = new Date(Date.now() + 90000000).toISOString();

      const requestBodies = [1, 2, 3].map((i) => ({
        driverId: validDriverId,
        hireType: "temporary",
        startDate,
        endDate,
        pickupLocation: `Pickup Point ${i}`,
        purpose: "Testing promo concurrency",
        promoCode: "FLASH50",
      }));

      const responses = [createMockResponse(), createMockResponse(), createMockResponse()];

      await Promise.all(
        requestBodies.map((body, idx) =>
          createBooking(
            {
              user: { _id: `507f1f77bcf86cd79943901${idx}` },
              body,
            } as any,
            responses[idx]
          )
        )
      );

      const successfulPromos = responses.filter(
        (r) => r.body.booking && r.body.booking.discountAmount > 0
      );
      const deniedPromos = responses.filter(
        (r) => r.body.booking && r.body.booking.discountAmount === 0
      );

      expect(successfulPromos).toHaveLength(2);
      expect(deniedPromos).toHaveLength(1);
      expect(atomicCounter).toBe(2);
    });
  });

  describe("3. Full State Machine Transitions (pending -> accepted -> ongoing -> completed / cancelled)", () => {
    it("should allow a driver to progress through pending -> accepted -> ongoing -> completed", async () => {
      const bookingDoc: any = {
        _id: "507f1f77bcf86cd799439055",
        user: validUserId,
        driver: validDriverId,
        status: "pending",
        paymentStatus: "pending",
        save: jest.fn().mockImplementation(async function (this: any) {
          return this;
        }),
      };

      jest.spyOn(Booking, "findById").mockImplementation(((id: any) => {
        return mockFindByIdDoc(bookingDoc);
      }) as any);

      // Step 1: pending -> accepted by driver
      const req1: any = {
        params: { id: "507f1f77bcf86cd799439055" },
        user: { _id: validDriverId },
        userRole: "driver",
        body: { status: "accepted" },
      };
      const res1 = createMockResponse();

      await updateBookingStatus(req1, res1);
      expect(res1.statusCode).toBe(200);
      expect(bookingDoc.status).toBe("accepted");

      // Step 2: accepted -> ongoing by driver
      const req2: any = {
        params: { id: "507f1f77bcf86cd799439055" },
        user: { _id: validDriverId },
        userRole: "driver",
        body: { status: "ongoing" },
      };
      const res2 = createMockResponse();

      await updateBookingStatus(req2, res2);
      expect(res2.statusCode).toBe(200);
      expect(bookingDoc.status).toBe("ongoing");

      // Step 3: ongoing -> completed by driver
      const req3: any = {
        params: { id: "507f1f77bcf86cd799439055" },
        user: { _id: validDriverId },
        userRole: "driver",
        body: { status: "completed" },
      };
      const res3 = createMockResponse();

      await updateBookingStatus(req3, res3);
      expect(res3.statusCode).toBe(200);
      expect(bookingDoc.status).toBe("completed");
    });

    it("should allow a user to cancel a pending booking", async () => {
      const bookingDoc: any = {
        _id: "507f1f77bcf86cd799439056",
        user: validUserId,
        driver: validDriverId,
        status: "pending",
        paymentStatus: "pending",
        save: jest.fn().mockImplementation(async function (this: any) {
          return this;
        }),
      };

      jest.spyOn(Booking, "findById").mockImplementation(((id: any) => {
        return mockFindByIdDoc(bookingDoc);
      }) as any);

      const req: any = {
        params: { id: "507f1f77bcf86cd799439056" },
        user: { _id: validUserId },
        userRole: "user",
        body: { status: "cancelled", cancellationReason: "Change of plans" },
      };
      const res = createMockResponse();

      await updateBookingStatus(req, res);

      expect(res.statusCode).toBe(200);
      expect(bookingDoc.status).toBe("cancelled");
      expect(bookingDoc.cancellationReason).toBe("Change of plans");
    });

    it("should process auto-refund when cancelling a paid booking", async () => {
      const bookingDoc: any = {
        _id: "507f1f77bcf86cd799439077",
        user: validUserId,
        driver: validDriverId,
        status: "accepted",
        paymentStatus: "paid",
        totalAmount: 1000,
        save: jest.fn().mockImplementation(async function (this: any) {
          return this;
        }),
      };

      jest.spyOn(Booking, "findById").mockImplementation(((id: any) => {
        return mockFindByIdDoc(bookingDoc);
      }) as any);

      const mockPaymentDoc: any = {
        _id: "pay_doc_123",
        booking: bookingDoc._id,
        status: "completed",
        amount: 1000,
        razorpayPaymentId: "pay_rzp_999",
        save: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(Payment, "findOne").mockResolvedValue(mockPaymentDoc as any);
      jest.spyOn(Driver, "findByIdAndUpdate").mockResolvedValue({} as any);
      jest.spyOn(WalletTransaction, "create").mockResolvedValue({} as any);

      const req: any = {
        params: { id: "507f1f77bcf86cd799439077" },
        user: { _id: validUserId },
        userRole: "user",
        body: { status: "cancelled" },
      };
      const res = createMockResponse();

      await updateBookingStatus(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockRefund).toHaveBeenCalledWith("pay_rzp_999", { amount: 100000 });
      expect(mockPaymentDoc.status).toBe("refunded");
      expect(bookingDoc.paymentStatus).toBe("refunded");
      expect(bookingDoc.status).toBe("cancelled");
    });

    it("should return 502 if auto-refund fails when cancelling a paid booking", async () => {
      const bookingDoc: any = {
        _id: "507f1f77bcf86cd799439078",
        user: validUserId,
        driver: validDriverId,
        status: "accepted",
        paymentStatus: "paid",
        totalAmount: 1000,
        save: jest.fn(),
      };

      jest.spyOn(Booking, "findById").mockResolvedValue(bookingDoc);

      const mockPaymentDoc: any = {
        _id: "pay_doc_fail",
        booking: bookingDoc._id,
        status: "completed",
        amount: 1000,
        razorpayPaymentId: "pay_rzp_err",
      };
      jest.spyOn(Payment, "findOne").mockResolvedValue(mockPaymentDoc as any);
      mockRefund.mockRejectedValueOnce(new Error("Gateway connection timeout"));

      const req: any = {
        params: { id: "507f1f77bcf86cd799439078" },
        user: { _id: validUserId },
        userRole: "user",
        body: { status: "cancelled" },
      };
      const res = createMockResponse();

      await updateBookingStatus(req, res);

      expect(res.statusCode).toBe(502);
      expect(res.body.message).toContain("Cancellation failed: refund could not be processed");
      // Booking status should not be changed to cancelled
      expect(bookingDoc.status).toBe("accepted");
    });

    it("should reject invalid state transitions (e.g. user moving pending -> completed)", async () => {
      const bookingDoc: any = {
        _id: "507f1f77bcf86cd799439057",
        user: validUserId,
        driver: validDriverId,
        status: "pending",
        save: jest.fn(),
      };

      jest.spyOn(Booking, "findById").mockResolvedValue(bookingDoc);

      const req: any = {
        params: { id: "507f1f77bcf86cd799439057" },
        user: { _id: validUserId },
        userRole: "user",
        body: { status: "completed" },
      };
      const res = createMockResponse();

      await updateBookingStatus(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("Cannot change a pending booking to completed");
    });

    it("should reject status update if user is unauthorized", async () => {
      const bookingDoc: any = {
        _id: "507f1f77bcf86cd799439058",
        user: validUserId,
        driver: validDriverId,
        status: "pending",
      };

      jest.spyOn(Booking, "findById").mockResolvedValue(bookingDoc);

      const req: any = {
        params: { id: "507f1f77bcf86cd799439058" },
        user: { _id: "507f1f77bcf86cd799439999" }, // Attacker ID
        userRole: "user",
        body: { status: "cancelled" },
      };
      const res = createMockResponse();

      await updateBookingStatus(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toBe("Not authorized");
    });

    it("should return 404 when booking does not exist", async () => {
      jest.spyOn(Booking, "findById").mockResolvedValue(null);

      const req: any = {
        params: { id: "507f1f77bcf86cd799439099" },
        user: { _id: "admin_user" },
        userRole: "admin",
        body: { status: "cancelled" },
      };
      const res = createMockResponse();

      await updateBookingStatus(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Booking not found");
    });
  });

  describe("4. Get Bookings, Stats & Details", () => {
    it("getUserBookings should return user's bookings with pagination", async () => {
      jest.spyOn(Booking, "countDocuments").mockResolvedValue(1 as never);
      const queryChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ _id: "b1", status: "pending" }] as never),
      };
      jest.spyOn(Booking, "find").mockReturnValue(queryChain as any);

      const req: any = {
        user: { _id: validUserId },
        query: { page: "1", limit: "10" },
      };
      const res = createMockResponse();

      await getUserBookings(req, res);

      expect(res.body.bookings).toHaveLength(1);
      expect(res.body.pagination).toBeDefined();
    });

    it("getDriverBookings should return driver's bookings with pagination", async () => {
      jest.spyOn(Booking, "countDocuments").mockResolvedValue(2 as never);
      const queryChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([
          { _id: "b1", status: "accepted" },
          { _id: "b2", status: "completed" },
        ] as never),
      };
      jest.spyOn(Booking, "find").mockReturnValue(queryChain as any);

      const req: any = {
        user: { _id: validDriverId },
        query: { page: "1", limit: "10" },
      };
      const res = createMockResponse();

      await getDriverBookings(req, res);

      expect(res.body.bookings).toHaveLength(2);
      expect(res.body.pagination).toBeDefined();
    });

    it("getDriverStats should return aggregate performance and earnings metrics", async () => {
      jest.spyOn(Booking, "aggregate").mockResolvedValue([
        { totalBookings: 10, completedBookings: 8, pendingBookings: 1, earnings: 12500 },
      ] as never);

      const req: any = { user: { _id: validDriverId } };
      const res = createMockResponse();

      await getDriverStats(req, res);

      expect(res.body.totalBookings).toBe(10);
      expect(res.body.completedBookings).toBe(8);
      expect(res.body.earnings).toBe(12500);
    });

    it("getBookingById should enforce authorization and return booking", async () => {
      const mockBooking = {
        _id: "507f1f77bcf86cd799439001",
        user: { _id: validUserId },
        driver: { _id: validDriverId },
      };

      const chain = {
        populate: jest.fn().mockReturnThis(),
      };
      (chain.populate as any).mockReturnValueOnce(chain);
      (chain.populate as any).mockResolvedValueOnce(mockBooking);
      jest.spyOn(Booking, "findById").mockReturnValue(chain as any);

      const req: any = {
        params: { id: "507f1f77bcf86cd799439001" },
        user: { _id: validUserId },
        userRole: "user",
      };
      const res = createMockResponse();

      await getBookingById(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.booking).toEqual(mockBooking);
    });
  });

  describe("5. Recurring Bookings, Calendar & Invoice IDOR Protection", () => {
    it("should create recurring daily bookings up to recurringEndDate", async () => {
      jest.spyOn(Driver, "findById").mockResolvedValue({
        _id: validDriverId,
        kycStatus: "approved",
        isActive: true,
        dailyRate: 1000,
      } as any);
      jest.spyOn(Booking, "findOne").mockResolvedValue(null);
      jest.spyOn(Booking, "insertMany").mockImplementation(async (items: any) =>
        items.map((item: any, idx: number) => ({ _id: `rec_booking_${idx}`, ...item }))
      );

      const start = new Date(Date.now() + 86400000);
      const endRecurring = new Date(Date.now() + 86400000 * 3);

      const req: any = {
        user: { _id: validUserId },
        body: {
          driverId: validDriverId,
          hireType: "permanent",
          startDate: start.toISOString(),
          pickupLocation: "Green Park",
          purpose: "Daily commute",
          isRecurring: true,
          recurringPattern: "daily",
          recurringEndDate: endRecurring.toISOString(),
        },
      };
      const res = createMockResponse();

      await createBooking(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.totalCreated).toBeGreaterThanOrEqual(2);
    });

    it("downloadInvoice should stream PDF for authorized completed and paid booking", async () => {
      const mockBooking = {
        _id: "507f1f77bcf86cd799439002",
        user: { _id: validUserId, name: "Alice", email: "alice@example.com" },
        driver: { _id: validDriverId, name: "Bob", email: "bob@example.com" },
        status: "completed",
        paymentStatus: "paid",
        startDate: new Date().toISOString(),
        pickupLocation: "South Ex",
        baseAmount: 500,
        surgeMultiplier: 1.2,
        discountAmount: 50,
        promoCode: "SAVE50",
        totalAmount: 550,
      };

      const chain = {
        populate: jest.fn().mockReturnThis(),
      };
      (chain.populate as any).mockReturnValueOnce(chain);
      (chain.populate as any).mockResolvedValueOnce(mockBooking);
      jest.spyOn(Booking, "findById").mockReturnValue(chain as any);

      const req: any = {
        params: { id: "507f1f77bcf86cd799439002" },
        user: { _id: validUserId },
        userRole: "user",
      };
      const res = createMockResponse();

      await downloadInvoice(req, res);

      expect(res.headers["Content-Type"]).toBe("application/pdf");
      expect(res.headers["Content-Disposition"]).toContain("invoice-507f1f77bcf86cd799439002.pdf");
    });

    it("downloadInvoice should block unauthorized users from downloading other invoices", async () => {
      const mockBooking = {
        _id: "507f1f77bcf86cd799439002",
        user: { _id: validUserId, name: "Alice", email: "alice@example.com" },
        driver: { _id: validDriverId, name: "Bob", email: "bob@example.com" },
        status: "completed",
        paymentStatus: "paid",
      };

      const chain = {
        populate: jest.fn().mockReturnThis(),
      };
      (chain.populate as any).mockReturnValueOnce(chain);
      (chain.populate as any).mockResolvedValueOnce(mockBooking);
      jest.spyOn(Booking, "findById").mockReturnValue(chain as any);

      // Eve attempts to download Alice's invoice
      const req: any = {
        params: { id: "507f1f77bcf86cd799439002" },
        user: { _id: "507f1f77bcf86cd799439999" },
        userRole: "user",
      };
      const res = createMockResponse();

      await downloadInvoice(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toContain("Not authorized to download this invoice");
    });

    it("downloadCalendar should block unauthorized access and allow authorized participants", async () => {
      const mockBooking = {
        _id: "507f1f77bcf86cd799439003",
        user: { _id: validUserId, name: "Alice", email: "alice@example.com" },
        driver: { _id: validDriverId, name: "Bob", email: "bob@example.com" },
        startDate: new Date(Date.now() + 86400000).toISOString(),
        pickupLocation: "Location A",
        dropLocation: "Location B",
        purpose: "Business",
      };

      const chain: any = {
        populate: jest.fn().mockImplementation(() => chain),
        then: (resolve: any) => resolve(mockBooking),
      };
      jest.spyOn(Booking, "findById").mockReturnValue(chain as any);

      // Unauthorized check
      const reqUnauth: any = {
        params: { id: "507f1f77bcf86cd799439003" },
        user: { _id: "507f1f77bcf86cd799439999" },
        userRole: "user",
      };
      const resUnauth = createMockResponse();
      await downloadCalendar(reqUnauth, resUnauth);
      expect(resUnauth.statusCode).toBe(403);

      // Authorized check
      const reqAuth: any = {
        params: { id: "507f1f77bcf86cd799439003" },
        user: { _id: validUserId },
        userRole: "user",
      };
      const resAuth = createMockResponse();
      await downloadCalendar(reqAuth, resAuth);
      expect(resAuth.headers["Content-Type"]).toContain("text/calendar");
    });
  });
});
