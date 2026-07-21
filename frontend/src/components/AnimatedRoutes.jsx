import { Routes, Route, useLocation } from "react-router-dom";
import { Suspense, lazy } from "react";
import { ProtectedRoute, PublicRoute } from "./ProtectedRoute";
const UserLayout = lazy(() => import("../layouts/UserLayout"));
const DriverLayout = lazy(() => import("../layouts/DriverLayout"));
const AdminLayout = lazy(() => import("../layouts/AdminLayout"));
const RoleLayout = lazy(() => import("../layouts/RoleLayout"));
const LandingPage = lazy(() => import("../pages/LandingPage"));
const UserLoginPage = lazy(() => import("../pages/UserLoginPage"));
const UserRegisterPage = lazy(() => import("../pages/UserRegisterPage"));
const DriverLoginPage = lazy(() => import("../pages/DriverLoginPage"));
const DriverRegisterPage = lazy(() => import("../pages/DriverRegisterPage"));
const AdminLoginPage = lazy(() => import("../pages/AdminLoginPage"));
const CompleteUserProfile = lazy(() => import("../pages/CompleteUserProfile"));
const CompleteDriverProfile = lazy(() => import("../pages/CompleteDriverProfile"));
const DriverSearchPage = lazy(() => import("../pages/DriverSearchPage"));
const DriverProfilePage = lazy(() => import("../pages/DriverProfilePage"));
const BookingsPage = lazy(() => import("../pages/BookingsPage"));
const BookingDetailPage = lazy(() => import("../pages/BookingDetailPage"));
const UserProfilePage = lazy(() => import("../pages/UserProfilePage"));
const FavoritesPage = lazy(() => import("../pages/FavoritesPage"));
const MessagesPage = lazy(() => import("../pages/MessagesPage"));
const DriverDashboard = lazy(() => import("../pages/DriverDashboard"));
const DriverProfileEdit = lazy(() => import("../pages/DriverProfileEdit"));
const DriverBookingsPage = lazy(() => import("../pages/DriverBookingsPage"));
const AdminDashboard = lazy(() => import("../pages/AdminDashboard"));
const AdminDriversPage = lazy(() => import("../pages/AdminDriversPage"));
const AdminUsersPage = lazy(() => import("../pages/AdminUsersPage"));
const AdminBookingsPage = lazy(() => import("../pages/AdminBookingsPage"));
const ForgotPasswordPage = lazy(() => import("../pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("../pages/ResetPasswordPage"));
const VerifyEmailPage = lazy(() => import("../pages/VerifyEmailPage"));
const NotFoundPage = lazy(() => import("../pages/NotFoundPage"));

import ErrorBoundary from "./ErrorBoundary";

const PageLoader = () => (
  <div className="h-full w-full flex items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

const PageWrapper = ({ children }) => {
  return (
    <div className="h-full w-full page-enter">
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          {children}
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

export default function AnimatedRoutes() {
  const location = useLocation();

  return (
    <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageWrapper><LandingPage /></PageWrapper>} />

        <Route path="/user/login" element={<PublicRoute><PageWrapper><UserLoginPage /></PageWrapper></PublicRoute>} />
        <Route path="/user/register" element={<PublicRoute><PageWrapper><UserRegisterPage /></PageWrapper></PublicRoute>} />
        <Route path="/driver/login" element={<PublicRoute><PageWrapper><DriverLoginPage /></PageWrapper></PublicRoute>} />
        <Route path="/driver/register" element={<PublicRoute><PageWrapper><DriverRegisterPage /></PageWrapper></PublicRoute>} />
        <Route path="/admin/login" element={<PageWrapper><AdminLoginPage /></PageWrapper>} />
        <Route path="/forgot-password" element={<PageWrapper><ForgotPasswordPage /></PageWrapper>} />
        <Route path="/reset-password/:token" element={<PageWrapper><ResetPasswordPage /></PageWrapper>} />
        <Route path="/verify-email" element={<PageWrapper><VerifyEmailPage /></PageWrapper>} />

        <Route element={<ProtectedRoute allowedRole="user" />}>
          <Route element={<UserLayout />}>
            <Route path="/complete-profile" element={<PageWrapper><CompleteUserProfile /></PageWrapper>} />
            <Route path="/drivers" element={<PageWrapper><DriverSearchPage /></PageWrapper>} />
            <Route path="/drivers/:id" element={<PageWrapper><DriverProfilePage /></PageWrapper>} />
            <Route path="/bookings" element={<PageWrapper><BookingsPage /></PageWrapper>} />
            <Route path="/favorites" element={<PageWrapper><FavoritesPage /></PageWrapper>} />
            <Route path="/profile" element={<PageWrapper><UserProfilePage /></PageWrapper>} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRole={["user", "driver", "admin"]} />}>
          <Route element={<RoleLayout />}>
            <Route path="/bookings/:id" element={<PageWrapper><BookingDetailPage /></PageWrapper>} />
            <Route path="/messages" element={<PageWrapper><MessagesPage /></PageWrapper>} />
            <Route path="/messages/:conversationId" element={<PageWrapper><MessagesPage /></PageWrapper>} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRole="driver" />}>
          <Route element={<DriverLayout />}>
            <Route path="/driver/complete-profile" element={<PageWrapper><CompleteDriverProfile /></PageWrapper>} />
            <Route path="/driver/dashboard" element={<PageWrapper><DriverDashboard /></PageWrapper>} />
            <Route path="/driver/bookings" element={<PageWrapper><DriverBookingsPage /></PageWrapper>} />
            <Route path="/driver/profile" element={<PageWrapper><DriverProfileEdit /></PageWrapper>} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRole="admin" />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/dashboard" element={<PageWrapper><AdminDashboard /></PageWrapper>} />
            <Route path="/admin/drivers" element={<PageWrapper><AdminDriversPage /></PageWrapper>} />
            <Route path="/admin/users" element={<PageWrapper><AdminUsersPage /></PageWrapper>} />
            <Route path="/admin/bookings" element={<PageWrapper><AdminBookingsPage /></PageWrapper>} />
          </Route>
        </Route>

        <Route path="*" element={<PageWrapper><NotFoundPage /></PageWrapper>} />
      </Routes>
  );
}

