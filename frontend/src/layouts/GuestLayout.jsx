import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { FaCar } from "react-icons/fa";
import { HiMenu, HiX } from "react-icons/hi";
import ThemeToggle from "../components/ThemeToggle";
import PageTransition from "../components/PageTransition";

export default function GuestLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { to: "/drivers", label: "Find Drivers" },
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
              <Link to="/" className="flex items-center gap-2 group">
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FaCar className="text-white text-sm" />
                </div>
                <span className="text-xl font-extrabold dark:text-white">
                  <span className="text-blue-600">My</span>Mate
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
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <ThemeToggle />
              <div className="flex items-center gap-2">
                <Link
                  to="/user/login"
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 transition-colors"
                >
                  Log In
                </Link>
                <Link
                  to="/user/register"
                  className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm shadow-blue-200 dark:shadow-none"
                >
                  Sign Up
                </Link>
              </div>
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
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
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
