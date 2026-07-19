import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { HiArrowLeft, HiMail, HiLockClosed, HiPhone, HiUser } from "react-icons/hi";
import { FaCar } from "react-icons/fa";
import toast from "react-hot-toast";

const authParticles = Array.from({ length: 15 }, () => ({
  left: `${Math.random() * 100}%`,
  top: `${Math.random() * 100}%`,
  size: `${Math.random() * 6 + 2}px`,
  delay: `${Math.random() * 8}s`,
  duration: `${Math.random() * 6 + 5}s`,
}));

const particleColors = ["#2563eb", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#06b6d4", "#0ea5e9", "#f59e0b", "#ec4899", "#14b8a6"];

export default function UserRegisterPage() {
  const [form, setForm] = useState({ email: "", password: "", gender: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await register("/auth/user/register", form);
      toast.success("Account created! Please login.");
      navigate("/user/login");
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setSubmitting(false);
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
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-8 group">
          <HiArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back to home
        </Link>

        <div className="bg-white rounded-3xl shadow-xl shadow-black/[0.04] border border-gray-100 p-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-6 shadow-lg shadow-blue-500/15">
            <FaCar className="text-white text-lg" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Create Account</h1>
          <p className="text-gray-500 text-sm mb-8">Sign up to find trusted drivers near you.</p>

          <form toolname="user_registration" tooldescription="Register a new user account" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <HiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                <input id="email" type="email" name="email" required value={form.email} onChange={handleChange} placeholder="your@email.com" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200" />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <HiLockClosed className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                <input id="password" type="password" name="password" required value={form.password} onChange={handleChange} placeholder="Min 6 characters" minLength={6} className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200" />
              </div>
            </div>
            <div>
              <label htmlFor="gender" className="block text-sm font-semibold text-gray-700 mb-1.5">Gender</label>
              <div className="relative">
                <HiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                <select id="gender" name="gender" value={form.gender} onChange={handleChange} required className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200 appearance-none">
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
              <div className="relative">
                <HiPhone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                <input id="phone" type="tel" name="phone" required value={form.phone} onChange={handleChange} placeholder="Enter your phone number" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200" />
              </div>
            </div>
            <button type="submit" disabled={submitting} className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-xl hover:shadow-blue-600/20 disabled:opacity-50 transition-all duration-300 hover:-translate-y-0.5">
              {submitting ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link to="/user/login" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}