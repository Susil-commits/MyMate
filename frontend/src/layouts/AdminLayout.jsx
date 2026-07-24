import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { HiShieldCheck } from "react-icons/hi";
import NotificationBell from "../components/NotificationBell";
import ThemeToggle from "../components/ThemeToggle";
import PageTransition from "../components/PageTransition";

export default function AdminLayout() {
  const { logout } = useAuth();
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
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 transition-colors duration-300">
      <nav className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link to="/admin/dashboard" className="flex items-center gap-2">
              <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center">
                <HiShieldCheck className="text-white text-sm" />
              </div>
 <span className="text-xl font-extrabold ">
                <span className="text-purple-600">My</span>Mate Admin
              </span>
            </Link>

            <div className="flex items-center gap-1">
              {links.map((link) => (
                <Link key={link.to} to={link.to} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  location.pathname === link.to
 ? "bg-purple-50 text-purple-600"
 : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}>
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <NotificationBell />
              <button onClick={handleLogout} className="px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200">
                Logout
              </button>
            </div>
          </div>
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
