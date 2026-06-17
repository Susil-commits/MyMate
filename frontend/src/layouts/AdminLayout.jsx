import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { HiShieldCheck, HiSun, HiMoon } from "react-icons/hi";

export default function AdminLayout() {
  const { logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const links = [
    { to: "/admin/dashboard", label: "Dashboard" },
    { to: "/admin/drivers", label: "Drivers" },
    { to: "/admin/users", label: "Users" },
    { to: "/admin/bookings", label: "Bookings" },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300">
      <nav className="sticky top-0 z-40 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-700 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link to="/admin/dashboard" className="flex items-center gap-2">
              <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center">
                <HiShieldCheck className="text-white text-sm" />
              </div>
              <span className="text-xl font-extrabold dark:text-white">
                <span className="text-purple-600">My</span>Mate Admin
              </span>
            </Link>

            <div className="flex items-center gap-1">
              {links.map((link) => (
                <Link key={link.to} to={link.to} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  location.pathname === link.to
                    ? "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}>
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggle}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {dark ? <HiSun className="w-5 h-5 text-yellow-400" /> : <HiMoon className="w-5 h-5 text-gray-600" />}
              </button>
              <button onClick={handleLogout} className="px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200">
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}