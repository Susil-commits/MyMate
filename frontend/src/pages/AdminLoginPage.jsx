import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { HiArrowLeft } from "react-icons/hi";
import toast from "react-hot-toast";

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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-purple-400/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-pink-400/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md px-4 z-10 animate-fade-up">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-8 group">
          <HiArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to home
        </Link>

        <div className="backdrop-blur-xl bg-white/70 rounded-3xl shadow-xl shadow-black/5 border border-white/50 p-8">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-1">Admin Access</h1>
          <p className="text-gray-500 mb-8">Enter your admin code to continue.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Admin Code</label>
              <input type="password" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter admin code" className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all duration-200 text-center text-xl tracking-widest" />
            </div>
            <button type="submit" disabled={submitting} className="w-full py-3.5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 hover:shadow-lg hover:shadow-purple-600/20 disabled:opacity-50 transition-all duration-300">
              {submitting ? "Verifying..." : "Access Admin"}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
            <Link to="/user/login" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">Back to User Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}