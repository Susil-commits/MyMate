import { useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { FaUserTie } from "react-icons/fa";
import { HiMenu, HiX, HiSun, HiMoon } from "react-icons/hi";
import NotificationBell from "../components/NotificationBell";

export default function DriverLayout() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const links = [
    { to: "/driver/dashboard", label: "Dashboard" },
    { to: "/driver/bookings", label: "Bookings" },
    { to: "/driver/profile", label: "Profile" },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300">
      <nav className="sticky top-0 z-40 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-700 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileOpen ? <HiX className="w-5 h-5 text-gray-600 dark:text-gray-300" /> : <HiMenu className="w-5 h-5 text-gray-600 dark:text-gray-300" />}
              </button>
              <Link to="/driver/dashboard" className="flex items-center gap-2 group">
                <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FaUserTie className="text-white text-sm" />
                </div>
                <span className="text-xl font-extrabold dark:text-white">
                  <span className="text-green-600">My</span>Mate
                </span>
              </Link>
            </div>

            <div className="hidden md:flex items-center gap-1">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    location.pathname === link.to
                      ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <NotificationBell />
              <button
                onClick={toggle}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {dark ? <HiSun className="w-5 h-5 text-yellow-400" /> : <HiMoon className="w-5 h-5 text-gray-600" />}
              </button>
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold">
                  {user?.name?.charAt(0)}
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{user?.name}</span>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200"
              >
                Logout
              </button>
            </div>
          </div>

          {mobileOpen && (
            <div className="md:hidden pb-4 border-t border-gray-100 dark:border-gray-700 pt-3 animate-slide-in-left">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    location.pathname === link.to
                      ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}