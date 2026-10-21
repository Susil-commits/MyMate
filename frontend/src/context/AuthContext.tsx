import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api/axios";

export interface AuthUser {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  profileCompleted?: boolean;
  avatar?: { url?: string; publicId?: string };
  walletBalance?: number;
  [key: string]: any;
}

export interface AuthContextType {
  user: AuthUser | null;
  role: string | null;
  loading: boolean;
  needsProfileCompletion: boolean;
  login: (endpoint: string, credentials: any) => Promise<any>;
  verify2FA: (endpoint: string, payload: any) => Promise<any>;
  register: (endpoint: string, formData: any) => Promise<any>;
  completeProfile: (endpoint: string, formData: any) => Promise<any>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export interface AuthProviderProps {
  children: React.ReactNode;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState<boolean>(false);

  const loadUser = useCallback(async (): Promise<void> => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setRole(data.role);
      setNeedsProfileCompletion(
        data.role !== "admin" && data.user && !data.user.profileCompleted
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

  const login = async (endpoint: string, credentials: any): Promise<any> => {
    const { data } = await api.post(endpoint, credentials);
    if (data.requires2FA) {
      return data;
    }
    setUser(data.user || data.driver || { role: data.role });
    setRole(data.role || data.user?.role || (data.driver ? "driver" : null));
    setNeedsProfileCompletion(data.needsProfileCompletion || false);
    return data;
  };

  const verify2FA = async (endpoint: string, payload: any): Promise<any> => {
    const { data } = await api.post(endpoint, payload);
    setUser(data.user || data.driver || { role: data.role });
    setRole(data.role || data.user?.role || (data.driver ? "driver" : null));
    setNeedsProfileCompletion(data.needsProfileCompletion || false);
    return data;
  };

  const register = async (endpoint: string, formData: any): Promise<any> => {
    const { data } = await api.post(endpoint, formData);
    return data;
  };

  const completeProfile = async (endpoint: string, formData: any): Promise<any> => {
    const { data } = await api.put(endpoint, formData);
    setUser(data.user || data.driver);
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
