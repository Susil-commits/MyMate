import { Routes, Route, useLocation } from "react-router-dom";
import { Suspense, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ProtectedRoute, PublicRoute } from "./ProtectedRoute";
import { lazyWithRetry } from "../utils/lazyWithRetry";

const UserLayout = lazyWithRetry(() => import("../layouts/UserLayout"));
const DriverLayout = lazyWithRetry(() => import("../layouts/DriverLayout"));
const AdminLayout = lazyWithRetry(() => import("../layouts/AdminLayout"));
const RoleLayout = lazyWithRetry(() => import("../layouts/RoleLayout"));
const SearchLayout = lazyWithRetry(() => import("../layouts/SearchLayout"));
const LandingPage = lazyWithRetry(() => import("../pages/LandingPage"));
const UserLoginPage = lazyWithRetry(() => import("../pages/UserLoginPage"));
const UserRegisterPage = lazyWithRetry(() => import("../pages/UserRegisterPage"));
const DriverLoginPage = lazyWithRetry(() => import("../pages/DriverLoginPage"));
const DriverRegisterPage = lazyWithRetry(() => import("../pages/DriverRegisterPage"));
const AdminLoginPage = lazyWithRetry(() => import("../pages/AdminLoginPage"));
const CompleteUserProfile = lazyWithRetry(() => import("../pages/CompleteUserProfile"));
const CompleteDriverProfile = lazyWithRetry(() => import("../pages/CompleteDriverProfile"));
const DriverSearchPage = lazyWithRetry(() => import("../pages/DriverSearchPage"));
const DriverProfilePage = lazyWithRetry(() => import("../pages/DriverProfilePage"));
const BookingsPage = lazyWithRetry(() => import("../pages/BookingsPage"));
const BookingDetailPage = lazyWithRetry(() => import("../pages/BookingDetailPage"));
const UserProfilePage = lazyWithRetry(() => import("../pages/UserProfilePage"));
const FavoritesPage = lazyWithRetry(() => import("../pages/FavoritesPage"));
const MessagesPage = lazyWithRetry(() => import("../pages/MessagesPage"));
const DriverDashboard = lazyWithRetry(() => import("../pages/DriverDashboard"));
const DriverProfileEdit = lazyWithRetry(() => import("../pages/DriverProfileEdit"));
const DriverBookingsPage = lazyWithRetry(() => import("../pages/DriverBookingsPage"));
const AdminDashboard = lazyWithRetry(() => import("../pages/AdminDashboard"));
const AdminDriversPage = lazyWithRetry(() => import("../pages/AdminDriversPage"));
const AdminUsersPage = lazyWithRetry(() => import("../pages/AdminUsersPage"));
const AdminBookingsPage = lazyWithRetry(() => import("../pages/AdminBookingsPage"));
const ForgotPasswordPage = lazyWithRetry(() => import("../pages/ForgotPasswordPage"));
const ResetPasswordPage = lazyWithRetry(() => import("../pages/ResetPasswordPage"));
const VerifyEmailPage = lazyWithRetry(() => import("../pages/VerifyEmailPage"));
const NotFoundPage = lazyWithRetry(() => import("../pages/NotFoundPage"));
const WalletPage = lazyWithRetry(() => import("../pages/WalletPage"));

import { OptionalRoute } from "./OptionalRoute";
import ErrorBoundary from "./ErrorBoundary";

const PageLoader = () => (
  <div className="h-full w-full flex items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

interface PageWrapperProps {
  children: ReactNode;
}

const PageWrapper = ({ children }: PageWrapperProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="h-full w-full"
    >
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          {children}
        </Suspense>
      </ErrorBoundary>
    </motion.div>
  );
};

export default function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
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

        <Route element={<OptionalRoute allowedRole="user" />}>
          <Route element={<SearchLayout />}>
            <Route path="/drivers" element={<PageWrapper><DriverSearchPage /></PageWrapper>} />
            <Route path="/drivers/:id" element={<PageWrapper><DriverProfilePage /></PageWrapper>} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRole="user" />}>
          <Route element={<UserLayout />}>
            <Route path="/complete-profile" element={<PageWrapper><CompleteUserProfile /></PageWrapper>} />
            <Route path="/bookings" element={<PageWrapper><BookingsPage /></PageWrapper>} />
            <Route path="/favorites" element={<PageWrapper><FavoritesPage /></PageWrapper>} />
            <Route path="/profile" element={<PageWrapper><UserProfilePage /></PageWrapper>} />
            <Route path="/wallet" element={<PageWrapper><WalletPage /></PageWrapper>} />
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
            <Route path="/driver/wallet" element={<PageWrapper><WalletPage /></PageWrapper>} />
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
    </AnimatePresence>
  );
}
