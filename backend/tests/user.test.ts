import request from "supertest";
import mongoose from "mongoose";
import { app } from "../server.js";

describe("Health Check", () => {
  it("should return ok", async () => {
    const res = await request(app).get("/health");
    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toEqual("ok");
  });
});
