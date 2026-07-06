import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(() => !!localStorage.getItem("token"));
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setRole(data.role);
      setNeedsProfileCompletion(
        data.role !== "admin" && data.user && !data.user.profileCompleted
      );
    } catch {
      localStorage.removeItem("token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // loadUser is async; all setState calls are deferred after await
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUser();
  }, [loadUser]);

  const login = async (endpoint, credentials) => {
    const { data } = await api.post(endpoint, credentials);
    localStorage.setItem("token", data.token);
    setUser(data.user || data.driver || { role: data.role });
    setRole(data.role || data.user?.role || (data.driver ? "driver" : null));
    setNeedsProfileCompletion(data.needsProfileCompletion || false);
    return data;
  };

  const register = async (endpoint, formData) => {
    const { data } = await api.post(endpoint, formData);
    return data;
  };

  const completeProfile = async (endpoint, formData, isMultipart = false) => {
    const config = isMultipart
      ? { headers: { "Content-Type": "multipart/form-data" } }
      : {};
    const { data } = await api.put(endpoint, formData, config);
    setUser(data.user || data.driver);
    setNeedsProfileCompletion(false);
    return data;
  };

  const logout = () => {
    localStorage.removeItem("token");
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
        register,
        completeProfile,
        logout,
        loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};