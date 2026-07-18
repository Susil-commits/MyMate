import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ProtectedRoute, PublicRoute } from "./ProtectedRoute";
import UserLayout from "../layouts/UserLayout";
import DriverLayout from "../layouts/DriverLayout";
import AdminLayout from "../layouts/AdminLayout";
import RoleLayout from "../layouts/RoleLayout";

import LandingPage from "../pages/LandingPage";
import UserLoginPage from "../pages/UserLoginPage";
import UserRegisterPage from "../pages/UserRegisterPage";
import DriverLoginPage from "../pages/DriverLoginPage";
import DriverRegisterPage from "../pages/DriverRegisterPage";
import AdminLoginPage from "../pages/AdminLoginPage";
import CompleteUserProfile from "../pages/CompleteUserProfile";
import CompleteDriverProfile from "../pages/CompleteDriverProfile";
import DriverSearchPage from "../pages/DriverSearchPage";
import DriverProfilePage from "../pages/DriverProfilePage";
import BookingsPage from "../pages/BookingsPage";
import BookingDetailPage from "../pages/BookingDetailPage";
import UserProfilePage from "../pages/UserProfilePage";
import FavoritesPage from "../pages/FavoritesPage";
import MessagesPage from "../pages/MessagesPage";
import DriverDashboard from "../pages/DriverDashboard";
import DriverProfileEdit from "../pages/DriverProfileEdit";
import DriverBookingsPage from "../pages/DriverBookingsPage";
import AdminDashboard from "../pages/AdminDashboard";
import AdminDriversPage from "../pages/AdminDriversPage";
import AdminUsersPage from "../pages/AdminUsersPage";
import AdminBookingsPage from "../pages/AdminBookingsPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import ResetPasswordPage from "../pages/ResetPasswordPage";
import VerifyEmailPage from "../pages/VerifyEmailPage";
import NotFoundPage from "../pages/NotFoundPage";

const PageWrapper = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="h-full w-full"
    >
      {children}
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
    </AnimatePresence>
  );
}
