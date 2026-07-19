import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { HiArrowLeft, HiMail, HiLockClosed, HiPhone, HiUser } from "react-icons/hi";
import { FaUserTie } from "react-icons/fa";
import toast from "react-hot-toast";

const PARTICLE_COUNT = 15;
const PARTICLE_COLORS = [
  "rgba(16,185,129,0.6)",
  "rgba(20,184,166,0.6)",
  "rgba(52,211,153,0.5)",
  "rgba(45,212,191,0.5)",
  "rgba(5,150,105,0.55)",
  "rgba(13,148,136,0.55)",
  "rgba(110,231,183,0.45)",
  "rgba(94,234,212,0.45)",
];

function generateParticles() {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: 4 + Math.random() * 8,
    duration: 8 + Math.random() * 14,
    delay: Math.random() * -20,
    xDrift: (Math.random() - 0.5) * 60,
    yDrift: (Math.random() - 0.5) * 60,
    color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
  }));
}

export default function DriverRegisterPage() {
  const [form, setForm] = useState({ email: "", password: "", gender: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const particles = useMemo(() => generateParticles(), []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await register("/auth/driver/register", form);
      toast.success("Driver account created! Please login.");
      navigate("/driver/login");
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-white">
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle, #0f766e 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-green-400/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 w-72 h-72 rounded-full bg-emerald-300/8 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-teal-300/8 blur-3xl" />
      </div>

      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            animation: `particleDrift ${p.duration}s ${p.delay}s infinite linear`,
            "--x-drift": `${p.xDrift}px`,
            "--y-drift": `${p.yDrift}px`,
          }}
        />
      ))}

      <style>{`
        @keyframes particleDrift {
          0%   { transform: translate(0, 0) scale(1); opacity: 0; }
          10%  { opacity: 0.8; }
          50%  { opacity: 0.5; }
          90%  { opacity: 0.8; }
          100% { transform: translate(var(--x-drift), var(--y-drift)) scale(0.6); opacity: 0; }
        }
      `}</style>

      <div className="relative w-full max-w-md px-4 z-10 animate-fade-up">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-8 group"
        >
          <HiArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to home
        </Link>

        <div className="backdrop-blur-xl bg-white rounded-3xl shadow-xl shadow-black/5 border border-gray-100 p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center shadow-lg shadow-green-500/20 mb-4">
              <FaUserTie className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-1">Join as Driver</h1>
            <p className="text-gray-500">Register and start earning with MyMate.</p>
          </div>

          <form toolname="driver_registration" tooldescription="Register a new driver account" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <HiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="your@email.com"
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <HiLockClosed className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Min 6 characters"
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label htmlFor="gender" className="block text-sm font-semibold text-gray-700 mb-1.5">Gender</label>
              <div className="relative">
                <HiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <select
                  id="gender"
                  name="gender"
                  required
                  value={form.gender}
                  onChange={handleChange}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all duration-200 appearance-none"
                >
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
                <HiPhone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="phone"
                  type="text"
                  name="phone"
                  required
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Enter your phone number"
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all duration-200"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-xl font-semibold hover:from-green-600 hover:to-teal-600 disabled:opacity-50 transition-all duration-300 hover:-translate-y-0.5 shadow-lg shadow-green-500/25"
            >
              {submitting ? "Creating account..." : "Register as Driver"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already registered?{" "}
            <Link
              to="/driver/login"
              className="text-green-600 hover:text-green-700 font-semibold transition-colors"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}