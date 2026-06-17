import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ allowedRole }) {
  const { user, role, loading, needsProfileCompletion } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    if (allowedRole === "driver") return <Navigate to="/driver/login" replace />;
    if (allowedRole === "admin") return <Navigate to="/user/login" replace />;
    return <Navigate to="/user/login" replace />;
  }

  if (allowedRole && role !== allowedRole) {
    if (role === "driver") return <Navigate to="/driver/dashboard" replace />;
    if (role === "admin") return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to="/drivers" replace />;
  }

  if (needsProfileCompletion && window.location.pathname !== "/complete-profile" && window.location.pathname !== "/driver/complete-profile") {
    if (role === "driver") return <Navigate to="/driver/complete-profile" replace />;
    if (role === "user") return <Navigate to="/complete-profile" replace />;
  }

  return <Outlet />;
}

export function PublicRoute({ children }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (user && role !== "admin") {
    if (role === "driver") return <Navigate to="/driver/dashboard" replace />;
    return <Navigate to="/drivers" replace />;
  }

  return children;
}