import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { SkeletonList } from "./SkeletonLoader";

export interface ProtectedRouteProps {
  allowedRole?: string | string[];
}

export function ProtectedRoute({ allowedRole }: ProtectedRouteProps): React.ReactElement {
  const { user, role, loading, needsProfileCompletion } = useAuth();
  const location = useLocation();
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

  if (!user) {
    if (allowed?.length === 1 && allowed[0] === "driver")
      return <Navigate to="/driver/login" replace />;
    if (allowed?.length === 1 && allowed[0] === "admin")
      return <Navigate to="/admin/login" replace />;
    return <Navigate to="/user/login" replace />;
  }

  if (allowed && role && !allowed.includes(role)) {
    if (role === "driver") return <Navigate to="/driver/dashboard" replace />;
    if (role === "admin") return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to="/drivers" replace />;
  }

  if (
    needsProfileCompletion &&
    location.pathname !== "/complete-profile" &&
    location.pathname !== "/driver/complete-profile"
  ) {
    if (role === "driver") return <Navigate to="/driver/complete-profile" replace />;
    if (role === "user") return <Navigate to="/complete-profile" replace />;
  }

  return <Outlet />;
}

export interface PublicRouteProps {
  children: React.ReactElement;
}

export function PublicRoute({ children }: PublicRouteProps): React.ReactElement {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <SkeletonList count={8} />
      </div>
    );
  }

  if (user && role !== "admin") {
    if (role === "driver") return <Navigate to="/driver/dashboard" replace />;
    return <Navigate to="/drivers" replace />;
  }

  return children;
}
