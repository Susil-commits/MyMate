import { Request, Response } from "express";
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createBooking } from "../controllers/bookingController";
import Booking from "../models/Booking";

describe.skip("Booking Controller", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = {
      body: { driverId: "some-id", hireType: "temporary", duration: 4 },
      user: { id: "user-id", name: "User" } as any,
    };
    res = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn() as any,
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should create a booking successfully", async () => {
    jest.spyOn(Booking.prototype, 'save').mockResolvedValue({});
    jest.spyOn(Booking, 'populate').mockResolvedValue({
      driverId: "some-id",
      status: "pending"
    } as any);

    await createBooking(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalled();
  });
});
