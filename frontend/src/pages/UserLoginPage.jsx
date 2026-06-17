import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { HiArrowLeft } from "react-icons/hi";
import toast from "react-hot-toast";

export default function UserLoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login("/auth/user/login", form);
      toast.success("Welcome back!");
      navigate("/drivers");
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-purple-400/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md px-4 z-10 animate-fade-up">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-8 group">
          <HiArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to home
        </Link>

        <div className="backdrop-blur-xl bg-white/70 rounded-3xl shadow-xl shadow-black/5 border border-white/50 p-8">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-1">Welcome back</h1>
          <p className="text-gray-500 mb-8">Sign in to find and hire drivers.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="your@email.com" className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200" />
            </div>
            <button type="submit" disabled={submitting} className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20 disabled:opacity-50 transition-all duration-300 hover:-translate-y-0.5">
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            <Link to="/forgot-password" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">Forgot password?</Link>
          </p>
          <p className="text-center text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <Link to="/user/register" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">Register</Link>
          </p>

          <div className="mt-4 pt-4 border-t border-gray-100 text-center space-y-2">
            <Link to="/driver/login" className="text-sm text-gray-500 hover:text-green-600 transition-colors block">Sign in as Driver</Link>
            <Link to="/admin/login" className="text-xs text-gray-400 hover:text-purple-600 transition-colors block">Admin Access</Link>
          </div>
        </div>
      </div>
    </div>
  );
}