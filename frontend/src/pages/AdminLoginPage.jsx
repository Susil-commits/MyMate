import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { HiArrowLeft, HiShieldCheck } from "react-icons/hi";
import toast from "react-hot-toast";

const authParticles = Array.from({ length: 15 }, () => ({
  left: `${Math.random() * 100}%`,
  top: `${Math.random() * 100}%`,
  size: `${Math.random() * 6 + 2}px`,
  delay: `${Math.random() * 8}s`,
  duration: `${Math.random() * 6 + 5}s`,
}));

const particleColors = [
  "#7c3aed", "#8b5cf6", "#a855f7", "#c084fc", "#6d28d9",
  "#9333ea", "#a21caf", "#c026d3", "#7e22ce", "#d946ef",
  "#a855f7", "#8b5cf6", "#7c3aed", "#c084fc", "#a21caf",
];

export default function AdminLoginPage() {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return toast.error("Enter admin code");
    setSubmitting(true);
    try {
      await login("/auth/admin/login", { code });
      toast.success("Admin access granted");
      navigate("/admin/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid admin code");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-white">
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #7c3aed 1px, transparent 1px)",
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

        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-purple-500/[0.03] blur-3xl" />
        <div className="absolute top-1/2 -left-20 w-[400px] h-[400px] rounded-full bg-pink-500/[0.03] blur-3xl" />
        <div className="absolute -bottom-40 left-1/2 w-[500px] h-[500px] rounded-full bg-violet-500/[0.03] blur-3xl" />
      </div>

      <div className="relative w-full max-w-md px-4 z-10 animate-fade-up">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-purple-600 transition-colors mb-8 group"
        >
          <HiArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to home
        </Link>

        <div className="bg-white rounded-3xl shadow-xl shadow-black/[0.04] border border-gray-100 p-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-violet-600 flex items-center justify-center mb-6 shadow-lg shadow-purple-500/20">
            <HiShieldCheck className="text-white text-xl" />
          </div>

          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">
            Admin Access
          </h1>
          <p className="text-gray-500 text-sm mb-8">
            Enter your admin code to continue.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Admin Code
              </label>
              <div className="relative">
                <HiShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
                <input
                  type="password"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all duration-200 font-mono tracking-widest"
                  style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-xl font-semibold hover:shadow-xl hover:shadow-purple-600/20 disabled:opacity-50 transition-all duration-300 hover:-translate-y-0.5"
            >
              {submitting ? "Verifying..." : "Access Admin"}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <Link
              to="/user/login"
              className="text-sm text-gray-400 hover:text-purple-600 transition-colors"
            >
              Back to User Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}