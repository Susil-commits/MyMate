import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email, role });
      setSent(true);
      toast.success("Reset link sent if email exists");
    } catch {
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white p-4">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Check your email</h2>
          <p className="text-gray-500 mt-2">If an account exists with that email, we've sent a password reset link.</p>
          <Link to="/user/login" className="inline-block mt-6 text-blue-600 font-semibold hover:underline">Back to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white p-4">
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-10 max-w-md w-full animate-fade-in">
        <h2 className="text-2xl font-extrabold text-gray-900 text-center">Forgot Password</h2>
        <p className="text-gray-500 text-sm text-center mt-1">Enter your email to receive a reset link</p>

        <div className="flex gap-2 mt-6 mb-5">
          <button
            type="button"
            onClick={() => setRole("user")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              role === "user" ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            User
          </button>
          <button
            type="button"
            onClick={() => setRole("driver")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              role === "driver" ? "bg-green-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Driver
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20 disabled:opacity-50 transition-all duration-300"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <p className="text-center mt-5 text-sm text-gray-500">
          <Link to="/user/login" className="text-blue-600 font-semibold hover:underline">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}