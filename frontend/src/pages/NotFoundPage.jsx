import { Link } from "react-router-dom";
import { FaCar } from "react-icons/fa";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-100/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center px-6">
        <div className="mb-8">
          <FaCar className="mx-auto text-8xl [&>path]:fill-[url(#carGradient)] animate-bounce" />
          <svg width="0" height="0">
            <defs>
              <linearGradient id="carGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#4f46e5" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <h1 className="text-[180px] font-black leading-none tracking-tighter bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent select-none">
          404
        </h1>

        <h2 className="text-3xl font-bold text-gray-900 mt-2 mb-3">
          Page not found
        </h2>

        <p className="text-gray-500 max-w-md mx-auto mb-10 text-lg leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
          Let's get you back on the road.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all duration-300"
          >
            <FaCar className="text-sm" />
            Back to Home
          </Link>

          <Link
            to="/drivers"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-gray-700 rounded-xl font-semibold border-2 border-gray-200 hover:border-blue-400 hover:text-blue-600 hover:-translate-y-0.5 transition-all duration-300 shadow-sm"
          >
            Browse Drivers
          </Link>
        </div>
      </div>
    </div>
  );
}