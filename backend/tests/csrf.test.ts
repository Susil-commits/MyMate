import { jest } from "@jest/globals";
import { generateCsrfToken, verifyCsrfToken, csrfProtection } from "../middleware/csrf.js";

describe("CSRF Defense-in-Depth Middleware Tests", () => {
  describe("1. Token Generation & Cryptographic Verification", () => {
    it("should generate a valid signed token", () => {
      const token = generateCsrfToken();
      expect(typeof token).toBe("string");
      expect(token).toContain(".");
      expect(verifyCsrfToken(token)).toBe(true);
    });

    it("should reject tampered or modified signature", () => {
      const token = generateCsrfToken();
      const [nonce] = token.split(".");
      const tampered = `${nonce}.deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef`;
      expect(verifyCsrfToken(tampered)).toBe(false);
    });

    it("should reject malformed tokens", () => {
      expect(verifyCsrfToken("")).toBe(false);
      expect(verifyCsrfToken("invalid-token-with-no-dot")).toBe(false);
      expect(verifyCsrfToken("a.b.c")).toBe(false);
      expect(verifyCsrfToken(null as any)).toBe(false);
    });
  });

  describe("2. Middleware Behavior", () => {
    function createMockReqRes(options: {
      method?: string;
      url?: string;
      cookies?: Record<string, string>;
      headers?: Record<string, string>;
    }) {
      const req: any = {
        method: options.method || "GET",
        originalUrl: options.url || "/api/v1/bookings",
        path: options.url || "/api/v1/bookings",
        cookies: options.cookies || {},
        headers: options.headers || {},
      };

      const res: any = {
        statusCode: 200,
        cookies: {} as Record<string, { val: string; options?: any }>,
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

      res.cookie = jest.fn((name: string, val: string, options: any) => {
        res.cookies[name] = { val, options };
        return res;
      });

      const next = jest.fn();

      return { req, res, next };
    }

    it("should set XSRF-TOKEN cookie on requests if not present", () => {
      const { req, res, next } = createMockReqRes({ method: "GET" });
      csrfProtection(req, res, next);

      expect(res.cookie).toHaveBeenCalledWith(
        "XSRF-TOKEN",
        expect.any(String),
        expect.objectContaining({ httpOnly: false })
      );
      expect(next).toHaveBeenCalled();
    });

    it("should allow safe HTTP methods (GET, HEAD, OPTIONS) without CSRF header", () => {
      const { req, res, next } = createMockReqRes({
        method: "GET",
        cookies: { token: "user_jwt_cookie" },
      });
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should allow mutating requests without a session cookie (unauthenticated)", () => {
      const { req, res, next } = createMockReqRes({
        method: "POST",
        url: "/api/v1/auth/user/login",
        cookies: {}, // No session cookie
      });
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should exempt Razorpay payment webhooks", () => {
      const { req, res, next } = createMockReqRes({
        method: "POST",
        url: "/api/v1/payments/webhook",
        cookies: { token: "user_jwt_cookie" },
      });
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should reject cookie-authenticated mutating request if CSRF header is missing", () => {
      const { req, res, next } = createMockReqRes({
        method: "POST",
        cookies: { token: "user_jwt_cookie" },
        headers: {},
      });
      csrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.body.message).toContain("CSRF token missing in request headers");
      expect(next).not.toHaveBeenCalled();
    });

    it("should reject cookie-authenticated mutating request if CSRF token signature is invalid", () => {
      const { req, res, next } = createMockReqRes({
        method: "POST",
        cookies: { token: "user_jwt_cookie" },
        headers: { "x-xsrf-token": "tampered_token.invalid_signature" },
      });
      csrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.body.message).toContain("Invalid CSRF token");
      expect(next).not.toHaveBeenCalled();
    });

    it("should reject if header token does not match cookie token (double-submit mismatch)", () => {
      const tokenA = generateCsrfToken();
      const tokenB = generateCsrfToken();

      const { req, res, next } = createMockReqRes({
        method: "POST",
        cookies: { token: "user_jwt_cookie", "XSRF-TOKEN": tokenA },
        headers: { "x-xsrf-token": tokenB },
      });
      csrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.body.message).toContain("CSRF token mismatch");
      expect(next).not.toHaveBeenCalled();
    });

    it("should allow cookie-authenticated mutating request with matching valid CSRF token", () => {
      const validToken = generateCsrfToken();

      const { req, res, next } = createMockReqRes({
        method: "POST",
        cookies: { token: "user_jwt_cookie", "XSRF-TOKEN": validToken },
        headers: { "x-xsrf-token": validToken },
      });
      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
