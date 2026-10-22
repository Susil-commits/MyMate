import { useState, FormEvent } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { HiArrowLeft, HiLockClosed } from "react-icons/hi";
import { FaCar } from "react-icons/fa";
import PasswordField from "../components/PasswordField";
import toast from "react-hot-toast";

const authParticles = Array.from({ length: 15 }, () => ({
  left: `${Math.random() * 100}%`,
  top: `${Math.random() * 100}%`,
  size: `${Math.random() * 6 + 2}px`,
  delay: `${Math.random() * 8}s`,
  duration: `${Math.random() * 6 + 5}s`,
}));

const particleColors = ["#2563eb", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#06b6d4", "#0ea5e9", "#f59e0b", "#ec4899", "#14b8a6"];

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { loadUser } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"user" | "driver">("user");
  const [loading, setLoading] = useState(false);

  const isConfirmTouched = confirmPassword.length > 0;
  const passwordsMatch = password === confirmPassword;
  const confirmError = isConfirmTouched && !passwordsMatch ? "Passwords do not match" : undefined;
  const matchSuccess = isConfirmTouched && passwordsMatch && password.length >= 6;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/reset-password", { token, password, role });
      localStorage.setItem("token", data.token);
      await loadUser();
      toast.success("Password reset successfully");
      navigate(role === "driver" ? "/driver/dashboard" : "/drivers");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-white">
      <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(circle, #2563eb 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {authParticles.map((p, i) => (
          <div key={i} className="hero-particle" style={{ left: p.left, top: p.top, width: p.size, height: p.size, animationDelay: p.delay, animationDuration: p.duration, background: particleColors[i % particleColors.length], opacity: 0.4 }} />
        ))}
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-blue-500/[0.025] blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-indigo-500/[0.025] blur-3xl" />
      </div>

      <div className="relative w-full max-w-md px-4 z-10 animate-fade-up">
        <Link to="/user/login" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-8 group">
          <HiArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back to login
        </Link>

        <div className="bg-white rounded-3xl shadow-xl shadow-black/[0.04] border border-gray-100 p-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-6 shadow-lg shadow-blue-500/15">
            <FaCar className="text-white text-lg" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Set New Password</h1>
          <p className="text-gray-500 text-sm mb-8">Enter your new password below.</p>

          <div className="flex gap-2 mb-6">
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

          <form onSubmit={handleSubmit} className="space-y-5">
            <PasswordField
              id="new-password"
              label="New Password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              leftIcon={<HiLockClosed className="w-4.5 h-4.5 text-gray-400" />}
              accentColor={role === "driver" ? "green" : "blue"}
            />
            <PasswordField
              id="confirm-password"
              label="Confirm Password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              leftIcon={<HiLockClosed className="w-4.5 h-4.5 text-gray-400" />}
              accentColor={role === "driver" ? "green" : "blue"}
              error={confirmError}
              matchSuccess={matchSuccess}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-xl hover:shadow-blue-600/20 disabled:opacity-50 transition-all duration-300 hover:-translate-y-0.5"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>

          <p className="text-center mt-6 text-sm text-gray-500">
            <Link to="/user/login" className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-semibold transition-colors group">
              <HiArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
