import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import BackButton from "../components/BackButton";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function UserProfilePage() {
  const { user, loadUser } = useAuth();
  const [form, setForm] = useState({ name: "", phone: "", locality: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({ name: user.name || "", phone: user.phone || "", locality: user.locality || "" });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("/users/profile", form);
      await loadUser();
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <BackButton label="Back" />
      <h1 className="text-3xl font-extrabold text-gray-900">My Profile</h1>

      <form onSubmit={handleSubmit} className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-5">
        <div className="flex items-center gap-4 pb-5 border-b border-gray-100">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
            {user?.name?.charAt(0)}
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{user?.name}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
          <input type="email" value={user?.email || ""} disabled className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-gray-50 text-gray-400 cursor-not-allowed" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Name</label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all duration-200" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone</label>
          <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all duration-200" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Locality</label>
          <input type="text" value={form.locality} onChange={(e) => setForm({ ...form, locality: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all duration-200" />
        </div>
        <button type="submit" disabled={saving} className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20 disabled:opacity-50 transition-all duration-300 hover:-translate-y-0.5">
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </span>
          ) : (
            "Update Profile"
          )}
        </button>
      </form>
    </div>
  );
}