import { Request, Response } from "express";
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { getDrivers } from "../controllers/driverController";
import Driver from "../models/Driver";

describe.skip("Driver Controller", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = {
      query: { locality: "Mumbai", page: "1", limit: "10" },
    };
    res = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn() as any,
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should get drivers successfully", async () => {
    jest.spyOn(Driver, 'find').mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ name: "Driver 1" }])
          })
        })
      })
    } as any);
    
    jest.spyOn(Driver, 'countDocuments').mockResolvedValue(1 as any);

    await getDrivers(req as Request, res as Response);

    expect(Driver.find).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });
});
