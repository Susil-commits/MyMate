import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { HiArrowLeft, HiMail, HiLockClosed } from "react-icons/hi";
import { FaUserTie } from "react-icons/fa";
import toast from "react-hot-toast";

const authParticles = Array.from({ length: 15 }, () => ({
  left: `${Math.random() * 100}%`,
  top: `${Math.random() * 100}%`,
  size: `${Math.random() * 6 + 2}px`,
  delay: `${Math.random() * 8}s`,
  duration: `${Math.random() * 6 + 5}s`,
}));

const particleColors = [
  "#059669", "#10b981", "#14b8a6", "#0d9488", "#06b6d4",
  "#22c55e", "#34d399", "#2dd4bf", "#0ea5e9", "#facc15",
  "#a3e635", "#5eead4", "#059669", "#10b981", "#14b8a6",
];

export default function DriverLoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login("/auth/driver/login", form);
      toast.success("Welcome back, driver!");
      navigate("/driver/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-white">
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: "radial-gradient(circle, #059669 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {authParticles.map((p, i) => (
          <div
            key={i}
            className="hero-particle"
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              animationDelay: p.delay,
              animationDuration: p.duration,
              background: particleColors[i % particleColors.length],
              opacity: 0.4,
            }}
          />
        ))}
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-green-500/[0.025] blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-teal-500/[0.025] blur-3xl" />
      </div>

      <div className="relative w-full max-w-md px-4 z-10 animate-fade-up">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-8 group"
        >
          <HiArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back to home
        </Link>

        <div className="bg-white rounded-3xl shadow-xl shadow-black/[0.04] border border-gray-100 p-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center mb-6 shadow-lg shadow-green-500/15">
            <FaUserTie className="text-white text-lg" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Driver Sign In</h1>
          <p className="text-gray-500 text-sm mb-8">Manage your bookings and profile.</p>

          <form toolname="driver_login" tooldescription="Log in as a driver" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <HiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="your@email.com"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all duration-200"
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <HiLockClosed className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all duration-200"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-xl font-semibold hover:shadow-xl hover:shadow-green-600/20 disabled:opacity-50 transition-all duration-300 hover:-translate-y-0.5"
            >
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            <Link to="/forgot-password" className="text-green-600 hover:text-green-700 font-semibold transition-colors">
              Forgot password?
            </Link>
          </p>
          <p className="text-center text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <Link to="/driver/register" className="text-green-600 hover:text-green-700 font-semibold transition-colors">
              Register
            </Link>
          </p>
          <div className="mt-5 pt-5 border-t border-gray-100 text-center">
            <Link to="/user/login" className="text-sm text-gray-400 hover:text-green-600 transition-colors block">
              Sign in as User
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}