import { jest } from "@jest/globals";
import crypto from "crypto";
import { authenticator } from "otplib";

// Mock email service and upload middleware before importing controllers
jest.unstable_mockModule("../config/email.js", () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendEmail: jest.fn().mockResolvedValue(undefined),
  sendBookingConfirmation: jest.fn().mockResolvedValue(undefined),
  sendBookingStatusUpdate: jest.fn().mockResolvedValue(undefined),
  sendKycStatusEmail: jest.fn().mockResolvedValue(undefined),
  transporter: { sendMail: jest.fn().mockResolvedValue({ messageId: "mock-id" }) },
}));

jest.unstable_mockModule("../middleware/upload.js", () => ({
  storeFile: jest.fn().mockResolvedValue({
    url: "https://cloudinary.com/mock-license.jpg",
    publicId: "mock-license-id",
  }),
  upload: {
    single: () => (req: any, res: any, next: any) => next(),
    fields: () => (req: any, res: any, next: any) => next(),
    array: () => (req: any, res: any, next: any) => next(),
  },
}));

// Dynamic imports
const {
  userRegister,
  userLogin,
  completeUserProfile,
  driverRegister,
  driverLogin,
  completeDriverProfile,
  adminLogin,
  logout,
  logoutAll,
  getMe,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
} = await import("../controllers/authController.js");

const { verify2FALogin } = await import("../controllers/twoFactorController.js");
const { protect } = await import("../middleware/auth.js");
const { generateToken } = await import("../utils/token.js");
const User = (await import("../models/User.js")).default;
const Driver = (await import("../models/Driver.js")).default;
const Admin = (await import("../models/Admin.js")).default;

function createMockResponse() {
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
  res.cookie = jest.fn((name: string, val: string, options?: any) => {
    res.cookies[name] = { val, options };
    return res;
  });
  return res;
}

describe("Authentication & Authorization Test Suite (TASK 2.1)", () => {
  const originalAdminCode = process.env.ADMIN_CODE;
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.ADMIN_CODE = "SUPER_SECRET_ADMIN_123";
    process.env.JWT_SECRET = "unit_test_jwt_secret_key_456";
  });

  afterAll(() => {
    process.env.ADMIN_CODE = originalAdminCode;
    process.env.JWT_SECRET = originalJwtSecret;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("1. User Registration Flow", () => {
    it("should register a new user successfully and dispatch verification email", async () => {
      const saveSpy = jest
        .spyOn(User.prototype, "save")
        .mockImplementation(async function (this: any) {
          return this;
        });

      const req: any = {
        body: {
          email: "alice@example.com",
          password: "Password123!",
          gender: "female",
          phone: "+919876543210",
        },
      };
      const res = createMockResponse();

      await userRegister(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.message).toContain("Account created. Please verify your email.");
      expect(saveSpy).toHaveBeenCalled();
    });
  });

  describe("2. User Login Flow & Failure Scenarios", () => {
    it("should login successfully with valid credentials and return JWT cookie", async () => {
      const mockUser = {
        _id: "user_id_123",
        email: "alice@example.com",
        isActive: true,
        isTwoFactorEnabled: false,
        profileCompleted: true,
        tokenVersion: 0,
        comparePassword: jest.fn().mockResolvedValue(true as never),
      };

      jest.spyOn(User, "findOne").mockResolvedValue(mockUser as any);

      const req: any = {
        body: {
          email: "alice@example.com",
          password: "Password123!",
        },
      };
      const res = createMockResponse();

      await userLogin(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.role).toBe("user");
      expect(res.body.needsProfileCompletion).toBe(false);
      expect(res.cookies["token"]).toBeDefined();
      expect(typeof res.cookies["token"].val).toBe("string");
    });

    it("should reject login when user is not found", async () => {
      jest.spyOn(User, "findOne").mockResolvedValue(null);

      const req: any = {
        body: {
          email: "unknown@example.com",
          password: "Password123!",
        },
      };
      const res = createMockResponse();

      await userLogin(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Invalid email or password");
      expect(res.cookies["token"]).toBeUndefined();
    });

    it("should reject login when password comparison fails", async () => {
      const mockUser = {
        _id: "user_id_123",
        email: "alice@example.com",
        isActive: true,
        comparePassword: jest.fn().mockResolvedValue(false as never),
      };

      jest.spyOn(User, "findOne").mockResolvedValue(mockUser as any);

      const req: any = {
        body: {
          email: "alice@example.com",
          password: "WrongPassword!",
        },
      };
      const res = createMockResponse();

      await userLogin(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Invalid email or password");
    });

    it("should reject deactivated users with 403 Forbidden", async () => {
      const deactivatedUser = {
        _id: "user_id_deactivated",
        email: "deactivated@example.com",
        isActive: false,
        comparePassword: jest.fn().mockResolvedValue(true as never),
      };

      jest.spyOn(User, "findOne").mockResolvedValue(deactivatedUser as any);

      const req: any = {
        body: {
          email: "deactivated@example.com",
          password: "Password123!",
        },
      };
      const res = createMockResponse();

      await userLogin(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toContain("deactivated");
    });
  });

  describe("3. 2FA Challenge & Verification Flow", () => {
    it("should require 2FA challenge when user has 2FA enabled", async () => {
      const twoFactorUser = {
        _id: "user_2fa_123",
        email: "secure@example.com",
        isActive: true,
        isTwoFactorEnabled: true,
        comparePassword: jest.fn().mockResolvedValue(true as never),
      };

      jest.spyOn(User, "findOne").mockResolvedValue(twoFactorUser as any);

      const req: any = {
        body: {
          email: "secure@example.com",
          password: "Password123!",
        },
      };
      const res = createMockResponse();

      await userLogin(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.requires2FA).toBe(true);
      expect(res.body.email).toBe("secure@example.com");
      // Must NOT issue token yet
      expect(res.cookies["token"]).toBeUndefined();
    });

    it("should verify 2FA token and issue JWT upon valid TOTP", async () => {
      const secret = authenticator.generateSecret();
      const validToken = authenticator.generate(secret);

      const mockDbUser = {
        _id: "user_2fa_123",
        email: "secure@example.com",
        isTwoFactorEnabled: true,
        twoFactorSecret: secret,
        profileCompleted: true,
        tokenVersion: 0,
      };

      const selectMock = jest.fn().mockResolvedValue(mockDbUser);
      jest.spyOn(User, "findOne").mockReturnValue({ select: selectMock } as any);

      const req: any = {
        body: {
          email: "secure@example.com",
          token: validToken,
          role: "user",
        },
      };
      const res = createMockResponse();

      await verify2FALogin(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.role).toBe("user");
      expect(res.cookies["token"]).toBeDefined();
    });

    it("should reject invalid 2FA token with AppError(400)", async () => {
      const secret = authenticator.generateSecret();

      const mockDbUser = {
        _id: "user_2fa_123",
        email: "secure@example.com",
        isTwoFactorEnabled: true,
        twoFactorSecret: secret,
      };

      const selectMock = jest.fn().mockResolvedValue(mockDbUser);
      jest.spyOn(User, "findOne").mockReturnValue({ select: selectMock } as any);

      const req: any = {
        body: {
          email: "secure@example.com",
          token: "000000", // invalid token
          role: "user",
        },
      };
      const res = createMockResponse();

      await expect(verify2FALogin(req, res)).rejects.toThrow("Invalid 2FA token");
    });
  });

  describe("4. Driver Registration, Login & Profile Completion", () => {
    it("should register a new driver successfully", async () => {
      jest.spyOn(Driver.prototype, "save").mockImplementation(async function (this: any) {
        return this;
      });

      const req: any = {
        body: {
          email: "driver@example.com",
          password: "Password123!",
          gender: "male",
          phone: "+919876543211",
        },
      };
      const res = createMockResponse();

      await driverRegister(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.message).toContain("Driver account created");
    });

    it("should login driver with valid credentials", async () => {
      const mockDriver = {
        _id: "driver_id_456",
        email: "driver@example.com",
        isTwoFactorEnabled: false,
        profileCompleted: false,
        tokenVersion: 0,
        comparePassword: jest.fn().mockResolvedValue(true as never),
      };

      jest.spyOn(Driver, "findOne").mockResolvedValue(mockDriver as any);

      const req: any = {
        body: {
          email: "driver@example.com",
          password: "Password123!",
        },
      };
      const res = createMockResponse();

      await driverLogin(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.role).toBe("driver");
      expect(res.body.needsProfileCompletion).toBe(true);
      expect(res.cookies["token"]).toBeDefined();
    });

    it("should complete driver profile with uploaded license image", async () => {
      const mockDriver: any = {
        _id: "driver_id_456",
        save: jest.fn().mockResolvedValue(undefined),
      };

      jest.spyOn(Driver, "findById").mockResolvedValue(mockDriver);

      const req: any = {
        user: { _id: "driver_id_456" },
        body: {
          name: "Bob Driver",
          nationality: "Indian",
          locality: "Downtown",
          licenseNumber: "DL-1234567890",
          experienceYears: 5,
          hourlyRate: 200,
          dailyRate: 1500,
          languages: "English, Hindi",
          vehicleTypes: ["Sedan", "SUV"],
          bio: "Experienced driver",
        },
        file: {
          buffer: Buffer.from("fake-image"),
          mimetype: "image/jpeg",
        },
      };
      const res = createMockResponse();

      await completeDriverProfile(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockDriver.profileCompleted).toBe(true);
      expect(mockDriver.kycStatus).toBe("pending");
      expect(mockDriver.licenseImage).toBeDefined();
      expect(mockDriver.licenseImage.publicId).toBe("mock-license-id");
    });
  });

  describe("5. Admin Login & Auth", () => {
    it("should succeed with correct admin code", async () => {
      const req: any = { body: { code: "SUPER_SECRET_ADMIN_123" } };
      const res = createMockResponse();

      await adminLogin(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.role).toBe("admin");
      expect(res.cookies["token"]).toBeDefined();
    });

    it("should fail with incorrect admin code", async () => {
      const req: any = { body: { code: "WRONG_CODE" } };
      const res = createMockResponse();

      await adminLogin(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Invalid admin code");
      expect(res.cookies["token"]).toBeUndefined();
    });

    it("should authenticate admin using email and password against Admin model", async () => {
      const mockAdmin: any = {
        _id: "admin_id_001",
        email: "boss@mymate.com",
        role: "admin",
        comparePassword: jest.fn().mockResolvedValue(true as never),
        save: jest.fn().mockResolvedValue(undefined),
      };

      jest.spyOn(Admin, "findOne").mockResolvedValue(mockAdmin);

      const req: any = {
        body: {
          email: "boss@mymate.com",
          password: "AdminSecretPassword123!",
        },
      };
      const res = createMockResponse();

      await adminLogin(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.role).toBe("admin");
      expect(mockAdmin.comparePassword).toHaveBeenCalledWith("AdminSecretPassword123!");
      expect(mockAdmin.save).toHaveBeenCalled();
      expect(res.cookies["token"]).toBeDefined();
    });

    it("should reject admin login if password does not match Admin record", async () => {
      const mockAdmin: any = {
        _id: "admin_id_001",
        email: "boss@mymate.com",
        role: "admin",
        comparePassword: jest.fn().mockResolvedValue(false as never),
      };

      jest.spyOn(Admin, "findOne").mockResolvedValue(mockAdmin);

      const req: any = {
        body: {
          email: "boss@mymate.com",
          password: "WrongPassword!",
        },
      };
      const res = createMockResponse();

      await adminLogin(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Invalid email or password");
    });
  });

  describe("6. Token Invalidation on Logout-All & Session Invalidation", () => {
    it("should clear cookie and respond on single logout", () => {
      const req: any = {};
      const res = createMockResponse();

      logout(req, res);

      expect(res.body.message).toBe("Logged out successfully");
      expect(res.cookies["token"].val).toBe("");
    });

    it("should increment tokenVersion and clear cookie on logoutAll", async () => {
      const findByIdAndUpdateSpy = jest
        .spyOn(User, "findByIdAndUpdate")
        .mockResolvedValue({} as any);

      const req: any = {
        user: { _id: "user_123" },
        userRole: "user",
      };
      const res = createMockResponse();

      await logoutAll(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toContain("Logged out from all sessions");
      expect(findByIdAndUpdateSpy).toHaveBeenCalledWith("user_123", {
        $inc: { tokenVersion: 1 },
      });
      expect(res.cookies["token"].val).toBe("");
    });

    it("protect middleware should allow request when tokenVersion matches", async () => {
      const user = {
        _id: "user_active_001",
        email: "test@user.com",
        isActive: true,
        tokenVersion: 3,
      };

      const token = generateToken(user, "user");

      const selectMock = jest.fn().mockResolvedValue(user);
      jest.spyOn(User, "findById").mockReturnValue({ select: selectMock } as any);

      const req: any = {
        cookies: { token },
        headers: {},
      };
      const res = createMockResponse();
      const next = jest.fn();

      await protect(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBe(user);
      expect(req.userRole).toBe("user");
    });

    it("protect middleware should reject request when tokenVersion has been incremented", async () => {
      const oldUserTokenState = {
        _id: "user_revoked_002",
        email: "revoked@user.com",
        tokenVersion: 1, // Issued at version 1
      };

      const token = generateToken(oldUserTokenState, "user");

      // Database now has tokenVersion 2 (e.g. after logout-all or password reset)
      const currentUserInDb = {
        _id: "user_revoked_002",
        email: "revoked@user.com",
        isActive: true,
        tokenVersion: 2,
      };

      const selectMock = jest.fn().mockResolvedValue(currentUserInDb);
      jest.spyOn(User, "findById").mockReturnValue({ select: selectMock } as any);

      const req: any = {
        cookies: { token },
        headers: {},
      };
      const res = createMockResponse();
      const next = jest.fn();

      await protect(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Session expired. Please log in again.");
    });
  });

  describe("7. Email Verification & Password Reset Flows", () => {
    it("verifyEmail should verify account on valid token", async () => {
      const mockUser = {
        _id: "user_verify_001",
        isEmailVerified: false,
        save: jest.fn().mockResolvedValue(undefined),
      };

      jest.spyOn(User, "findOne").mockResolvedValue(mockUser as any);

      const req: any = {
        body: {
          token: "valid_email_token_32chars_long_12345",
          role: "user",
        },
      };
      const res = createMockResponse();

      await verifyEmail(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockUser.isEmailVerified).toBe(true);
      expect(res.body.message).toContain("Email verified successfully");
    });

    it("verifyEmail should fail on expired or invalid token", async () => {
      jest.spyOn(User, "findOne").mockResolvedValue(null);

      const req: any = {
        body: {
          token: "invalid_token",
          role: "user",
        },
      };
      const res = createMockResponse();

      await verifyEmail(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("Invalid or expired");
    });

    it("forgotPassword should generate token and send email if account exists", async () => {
      const mockUser = {
        _id: "user_forgot_001",
        email: "forgot@example.com",
        getResetPasswordToken: jest.fn().mockReturnValue("generated_reset_token"),
        save: jest.fn().mockResolvedValue(undefined),
      };

      jest.spyOn(User, "findOne").mockResolvedValue(mockUser as any);

      const req: any = {
        body: {
          email: "forgot@example.com",
          role: "user",
        },
      };
      const res = createMockResponse();

      await forgotPassword(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockUser.getResetPasswordToken).toHaveBeenCalled();
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.body.message).toContain("If an account exists");
    });

    it("resetPassword should update password and increment tokenVersion", async () => {
      const mockUser: any = {
        _id: "user_reset_001",
        password: "OldPassword1!",
        tokenVersion: 1,
        save: jest.fn().mockResolvedValue(undefined),
      };

      jest.spyOn(User, "findOne").mockResolvedValue(mockUser as any);

      const req: any = {
        body: {
          token: "valid_reset_token_hex_value",
          password: "BrandNewPassword123!",
          role: "user",
        },
      };
      const res = createMockResponse();

      await resetPassword(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockUser.password).toBe("BrandNewPassword123!");
      expect(mockUser.tokenVersion).toBe(2);
      expect(res.cookies["token"]).toBeDefined();
    });

    it("resendVerification should trigger verification email if unverified", async () => {
      const mockUser = {
        _id: "user_resend_001",
        email: "unverified@example.com",
        isEmailVerified: false,
        save: jest.fn().mockResolvedValue(undefined),
      };

      jest.spyOn(User, "findOne").mockResolvedValue(mockUser as any);

      const req: any = {
        body: {
          email: "unverified@example.com",
          role: "user",
        },
      };
      const res = createMockResponse();

      await resendVerification(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it("getMe should return user and role when authenticated", async () => {
      const req: any = {
        user: { _id: "user_me", name: "Me" },
        userRole: "user",
      };
      const res = createMockResponse();

      await getMe(req, res);

      expect(res.body.user).toEqual({ _id: "user_me", name: "Me" });
      expect(res.body.role).toBe("user");
    });

    it("completeUserProfile should update user profile", async () => {
      const mockUser: any = {
        _id: "user_prof_001",
        save: jest.fn().mockResolvedValue(undefined),
      };

      jest.spyOn(User, "findById").mockResolvedValue(mockUser as any);

      const req: any = {
        user: { _id: "user_prof_001" },
        body: {
          name: "Alice Wonderland",
          locality: "Downtown Manhattan",
        },
      };
      const res = createMockResponse();

      await completeUserProfile(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockUser.name).toBe("Alice Wonderland");
      expect(mockUser.profileCompleted).toBe(true);
    });
  });
});
