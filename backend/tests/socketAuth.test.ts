import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import { socketAuthMiddleware, AuthenticatedSocket } from "../utils/socket.js";

describe("Socket.io Authentication Middleware", () => {
  const secret = "test-jwt-secret-key-12345";
  const originalSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = secret;
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it("should authenticate socket via cookie header", () => {
    const payload = { id: "user123", role: "user" };
    const token = jwt.sign(payload, secret);

    const socket = {
      handshake: {
        headers: {
          cookie: `token=${token}; other_cookie=abc`,
        },
        auth: {},
      },
      user: undefined,
    } as unknown as AuthenticatedSocket;

    const next = jest.fn();
    socketAuthMiddleware(socket, next);

    expect(next).toHaveBeenCalledWith();
    expect(socket.user).toBeDefined();
    expect(socket.user.id).toBe("user123");
    expect(socket.user.role).toBe("user");
  });

  it("should fallback to handshake.auth.token if cookie is missing", () => {
    const payload = { id: "driver456", role: "driver" };
    const token = jwt.sign(payload, secret);

    const socket = {
      handshake: {
        headers: {},
        auth: { token },
      },
      user: undefined,
    } as unknown as AuthenticatedSocket;

    const next = jest.fn();
    socketAuthMiddleware(socket, next);

    expect(next).toHaveBeenCalledWith();
    expect(socket.user).toBeDefined();
    expect(socket.user.id).toBe("driver456");
  });

  it("should reject connection when no token is present in cookie or auth", () => {
    const socket = {
      handshake: {
        headers: { cookie: "other_cookie=xyz" },
        auth: {},
      },
      user: undefined,
    } as unknown as AuthenticatedSocket;

    const next = jest.fn();
    socketAuthMiddleware(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const err = (next as jest.Mock).mock.calls[0][0] as Error;
    expect(err.message).toBe("Authentication error: No token provided");
    expect(socket.user).toBeUndefined();
  });

  it("should reject connection when token is invalid or tampered", () => {
    const socket = {
      handshake: {
        headers: { cookie: "token=invalid.token.here" },
        auth: {},
      },
      user: undefined,
    } as unknown as AuthenticatedSocket;

    const next = jest.fn();
    socketAuthMiddleware(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const err = (next as jest.Mock).mock.calls[0][0] as Error;
    expect(err.message).toBe("Authentication error: Invalid token");
    expect(socket.user).toBeUndefined();
  });
});
