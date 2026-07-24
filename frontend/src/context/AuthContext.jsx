import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  // We don't have token in localStorage anymore, so assume loading is true initially to try fetching user
  const [loading, setLoading] = useState(true);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);

  const loadUser = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setRole(data.role);
      setNeedsProfileCompletion(
        data.role !== "admin" && data.user && !data.user.profileCompleted
      );
    } catch {
      // If 401, we are just not logged in
      setUser(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUser();
  }, [loadUser]);

  const login = async (endpoint, credentials) => {
    const { data } = await api.post(endpoint, credentials);
    setUser(data.user || data.driver || { role: data.role });
    setRole(data.role || data.user?.role || (data.driver ? "driver" : null));
    setNeedsProfileCompletion(data.needsProfileCompletion || false);
    return data;
  };

  const register = async (endpoint, formData) => {
    const { data } = await api.post(endpoint, formData);
    return data;
  };

  const completeProfile = async (endpoint, formData) => {
    const { data } = await api.put(endpoint, formData);
    setUser(data.user || data.driver);
    setNeedsProfileCompletion(false);
    return data;
  };

  const logout = async () => {
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