import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { SkeletonList } from "./SkeletonLoader";

export function OptionalRoute({ allowedRole, redirectIfWrongRole = "/drivers" }) {
  const { user, role, loading } = useAuth();
  
  const allowed = allowedRole
    ? Array.isArray(allowedRole)
      ? allowedRole
      : [allowedRole]
    : null;

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <SkeletonList count={8} />
      </div>
    );
  }

  // If logged in, but not the right role (e.g. an admin trying to view user search)
  if (user && allowed && !allowed.includes(role)) {
    if (role === "driver") return <Navigate to="/driver/dashboard" replace />;
    if (role === "admin") return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to={redirectIfWrongRole} replace />;
  }

  return <Outlet />;
}
