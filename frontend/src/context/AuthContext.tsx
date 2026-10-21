import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api/axios";

export type UserRole = "user" | "driver" | "admin";

export interface AuthUser {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  profileCompleted?: boolean;
  avatar?: { url?: string; publicId?: string };
  walletBalance?: number;
  locality?: string;
  isTwoFactorEnabled?: boolean;
  gender?: string;
  // Driver specific fields
  nationality?: string;
  licenseNumber?: string;
  licenseImage?: { url?: string; publicId?: string };
  experienceYears?: number | string;
  hourlyRate?: number | string;
  dailyRate?: number | string;
  bio?: string;
  availability?: "available" | "busy" | "offline";
  vehicleTypes?: string[];
  languages?: string[];
  kycStatus?: "pending" | "approved" | "rejected" | string;
  averageRating?: number;
  totalReviews?: number;
  isActive?: boolean;
}

export interface EmailPasswordCredentials {
  email: string;
  password: string;
}

export interface AdminCodeCredentials {
  code: string;
  email?: string;
  password?: string;
}

export interface TwoFactorLoginCredentials {
  email: string;
  token: string;
  role: "user" | "driver";
}

export type LoginCredentials =
  | EmailPasswordCredentials
  | AdminCodeCredentials
  | TwoFactorLoginCredentials;

export interface TwoFactorChallengeResponse {
  requires2FA: true;
  role: "user" | "driver";
  email: string;
  message?: string;
}

export interface AuthSuccessResponse {
  requires2FA?: false;
  role: UserRole;
  user?: AuthUser;
  driver?: AuthUser;
  admin?: AuthUser;
  needsProfileCompletion?: boolean;
  message?: string;
}

export type AuthResponse = TwoFactorChallengeResponse | AuthSuccessResponse;

export interface Verify2FAPayload {
  token: string;
  email?: string;
  role?: "user" | "driver";
}

export interface UserRegisterPayload {
  email: string;
  password: string;
  name?: string;
  phone?: string;
  gender?: string;
  locality?: string;
}

export interface DriverRegisterPayload {
  email: string;
  password: string;
  gender?: string;
  phone?: string;
}

export type RegisterPayload =
  | UserRegisterPayload
  | DriverRegisterPayload
  | Record<string, unknown>;

export interface RegisterResponse {
  message?: string;
  user?: AuthUser;
  driver?: AuthUser;
}

export interface CompleteUserProfilePayload {
  name: string;
  locality: string;
  phone?: string;
}

export interface CompleteDriverProfilePayload {
  name?: string;
  nationality?: string;
  locality?: string;
  experienceYears?: number | string;
  hourlyRate?: number | string;
  dailyRate?: number | string;
  bio?: string;
  availability?: "available" | "busy" | "offline";
  vehicleTypes?: string[];
  languages?: string;
  licenseNumber?: string;
}

export type CompleteProfilePayload =
  | CompleteUserProfilePayload
  | CompleteDriverProfilePayload
  | FormData
  | Record<string, unknown>;

export interface CompleteProfileResponse {
  user?: AuthUser;
  driver?: AuthUser;
  message?: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
  loading: boolean;
  needsProfileCompletion: boolean;
  login: (endpoint: string, credentials: LoginCredentials) => Promise<AuthResponse>;
  verify2FA: (endpoint: string, payload: Verify2FAPayload) => Promise<AuthSuccessResponse>;
  register: (endpoint: string, formData: RegisterPayload) => Promise<RegisterResponse>;
  completeProfile: (endpoint: string, formData: CompleteProfilePayload) => Promise<CompleteProfileResponse>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export interface AuthProviderProps {
  children: React.ReactNode;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState<boolean>(false);

  const loadUser = useCallback(async (): Promise<void> => {
    try {
      const { data } = await api.get<{
        user: AuthUser | null;
        role: UserRole | null;
      }>("/auth/me");
      setUser(data.user);
      setRole(data.role);
      setNeedsProfileCompletion(
        data.role !== "admin" && Boolean(data.user && !data.user.profileCompleted)
      );
    } catch {
      // If 401 or network error, not logged in
      setUser(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (
    endpoint: string,
    credentials: LoginCredentials
  ): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>(endpoint, credentials);
    if (data.requires2FA) {
      return data;
    }
    const resolvedUser = (data.user || data.driver || data.admin || { role: data.role }) as AuthUser;
    setUser(resolvedUser);
    setRole(data.role);
    setNeedsProfileCompletion(data.needsProfileCompletion || false);
    return data;
  };

  const verify2FA = async (
    endpoint: string,
    payload: Verify2FAPayload
  ): Promise<AuthSuccessResponse> => {
    const { data } = await api.post<AuthSuccessResponse>(endpoint, payload);
    const resolvedUser = (data.user || data.driver || data.admin || { role: data.role }) as AuthUser;
    setUser(resolvedUser);
    setRole(data.role);
    setNeedsProfileCompletion(data.needsProfileCompletion || false);
    return data;
  };

  const register = async (
    endpoint: string,
    formData: RegisterPayload
  ): Promise<RegisterResponse> => {
    const { data } = await api.post<RegisterResponse>(endpoint, formData);
    return data;
  };

  const completeProfile = async (
    endpoint: string,
    formData: CompleteProfilePayload
  ): Promise<CompleteProfileResponse> => {
    const { data } = await api.put<CompleteProfileResponse>(endpoint, formData);
    const updatedUser = (data.user || data.driver) as AuthUser | undefined;
    if (updatedUser) {
      setUser(updatedUser);
    }
    setNeedsProfileCompletion(false);
    return data;
  };

  const logout = async (): Promise<void> => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.error("Logout failed:", err);
    }
    setUser(null);
    setRole(null);
    setNeedsProfileCompletion(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        needsProfileCompletion,
        login,
        verify2FA,
        register,
        completeProfile,
        logout,
        loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
