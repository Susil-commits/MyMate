import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { HiArrowLeft } from "react-icons/hi";
import toast from "react-hot-toast";

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
          <h1 className="text-3xl font-extrabold text-gray-900 mb-1">Create Account</h1>
          <p className="text-gray-500 mb-8">Sign up to find trusted drivers near you.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email" name="email" type="email" value={form.email} onChange={handleChange} required placeholder="your@email.com" />
            <Field label="Password" name="password" type="password" value={form.password} onChange={handleChange} required placeholder="Min 6 characters" minLength={6} />
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Gender</label>
              <select name="gender" value={form.gender} onChange={handleChange} required className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all duration-200">
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <Field label="Phone Number" name="phone" value={form.phone} onChange={handleChange} required placeholder="Enter your phone number" />
            <button type="submit" disabled={submitting} className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20 disabled:opacity-50 transition-all duration-300 hover:-translate-y-0.5">
              {submitting ? "Creating account..." : "Register"}
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

function Field({ label, name, type = "text", value, onChange, required, placeholder, minLength }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      <input type={type} name={name} value={value} onChange={onChange} required={required} minLength={minLength} placeholder={placeholder} className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all duration-200" />
    </div>
  );
}