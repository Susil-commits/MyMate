import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function CompleteUserProfile() {
  const { user, completeProfile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: user?.name || "",
    locality: user?.locality || "",
  });
  const [saving, setSaving] = useState(false);

  if (user?.profileCompleted) {
    navigate("/drivers", { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await completeProfile("/auth/user/complete-profile", form);
      toast.success("Profile completed!");
      navigate("/drivers");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to complete profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4">
      <div className="max-w-md w-full animate-fade-up">
        <div className="backdrop-blur-xl bg-white/70 rounded-3xl shadow-xl shadow-black/5 border border-white/50 p-8">
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Complete Your Profile</h1>
          <p className="text-gray-500 mb-6">Just a few more details to get started.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Enter your full name" className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all duration-200" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Locality (City/Area)</label>
              <input type="text" required value={form.locality} onChange={(e) => setForm({ ...form, locality: e.target.value })} placeholder="Your city or area" className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all duration-200" />
            </div>
            <button type="submit" disabled={saving} className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20 disabled:opacity-50 transition-all duration-300">
              {saving ? "Saving..." : "Complete Profile"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}