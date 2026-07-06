import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from "react-hot-toast";
import { ProtectedRoute, PublicRoute } from "./components/ProtectedRoute";
import UserLayout from "./layouts/UserLayout";
import DriverLayout from "./layouts/DriverLayout";
import AdminLayout from "./layouts/AdminLayout";
import RoleLayout from "./layouts/RoleLayout";
import LandingPage from "./pages/LandingPage";
import UserLoginPage from "./pages/UserLoginPage";
import UserRegisterPage from "./pages/UserRegisterPage";
import DriverLoginPage from "./pages/DriverLoginPage";
import DriverRegisterPage from "./pages/DriverRegisterPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import CompleteUserProfile from "./pages/CompleteUserProfile";
import CompleteDriverProfile from "./pages/CompleteDriverProfile";
import DriverSearchPage from "./pages/DriverSearchPage";
import DriverProfilePage from "./pages/DriverProfilePage";
import BookingsPage from "./pages/BookingsPage";
import BookingDetailPage from "./pages/BookingDetailPage";
import UserProfilePage from "./pages/UserProfilePage";
import FavoritesPage from "./pages/FavoritesPage";
import MessagesPage from "./pages/MessagesPage";
import DriverDashboard from "./pages/DriverDashboard";
import DriverProfileEdit from "./pages/DriverProfileEdit";
import DriverBookingsPage from "./pages/DriverBookingsPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminDriversPage from "./pages/AdminDriversPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminBookingsPage from "./pages/AdminBookingsPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
          <Toaster position="top-right" />
          <Routes>
            <Route path="/" element={<LandingPage />} />

            <Route path="/user/login" element={<PublicRoute><UserLoginPage /></PublicRoute>} />
            <Route path="/user/register" element={<PublicRoute><UserRegisterPage /></PublicRoute>} />
            <Route path="/driver/login" element={<PublicRoute><DriverLoginPage /></PublicRoute>} />
            <Route path="/driver/register" element={<PublicRoute><DriverRegisterPage /></PublicRoute>} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />

            <Route element={<ProtectedRoute allowedRole="user" />}>
              <Route element={<UserLayout />}>
                <Route path="/complete-profile" element={<CompleteUserProfile />} />
                <Route path="/drivers" element={<DriverSearchPage />} />
                <Route path="/drivers/:id" element={<DriverProfilePage />} />
                <Route path="/bookings" element={<BookingsPage />} />
                <Route path="/favorites" element={<FavoritesPage />} />
                <Route path="/profile" element={<UserProfilePage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute allowedRole={["user", "driver", "admin"]} />}>
              <Route element={<RoleLayout />}>
                <Route path="/bookings/:id" element={<BookingDetailPage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/messages/:conversationId" element={<MessagesPage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute allowedRole="driver" />}>
              <Route element={<DriverLayout />}>
                <Route path="/driver/complete-profile" element={<CompleteDriverProfile />} />
                <Route path="/driver/dashboard" element={<DriverDashboard />} />
                <Route path="/driver/bookings" element={<DriverBookingsPage />} />
                <Route path="/driver/profile" element={<DriverProfileEdit />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute allowedRole="admin" />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/drivers" element={<AdminDriversPage />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/bookings" element={<AdminBookingsPage />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
  );
}