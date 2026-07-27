import { useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FaUserTie } from "react-icons/fa";
import { HiMenu, HiX } from "react-icons/hi";
import NotificationBell from "../components/NotificationBell";
import ThemeToggle from "../components/ThemeToggle";
import PageTransition from "../components/PageTransition";

export default function DriverLayout() {
  const { user, logout } = useAuth();
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
    { to: "/messages", label: "Messages" },
    { to: "/driver/profile", label: "Profile" },
  ];

  const isActive = (to) =>
    to === "/"
      ? location.pathname === "/"
      : location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 transition-colors duration-300">
      <nav className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
 className="md:hidden p-2 rounded-xl hover:text-gray-700 transition-colors"
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
                    isActive(link.to)
                      ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <NotificationBell />
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold">
                  {user?.name?.charAt(0)}
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{user?.name}</span>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200"
              >
                Logout
              </button>
            </div>
          </div>

          {mobileOpen && (
 <div className="md:hidden pb-4 border-t border-gray-100 dark:border-gray-800 pt-3 animate-slide-in-left">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive(link.to)
                      ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                      : "text-gray-600 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
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
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
    </div>
  );
}
