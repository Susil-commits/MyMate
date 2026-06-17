import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-10">
        <h1 className="text-9xl font-extrabold text-gray-200">404</h1>
        <h2 className="text-2xl font-bold text-gray-900 mt-4">Page not found</h2>
        <p className="text-gray-500 mt-2 mb-8">The page you're looking for doesn't exist or has been moved.</p>
        <Link
          to="/"
          className="inline-block px-8 py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20 transition-all duration-300"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}