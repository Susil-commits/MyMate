import { useState } from "react";
import BackButton from "../components/BackButton";
import Avatar from "../components/Avatar";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function UserProfilePage() {
  const { user, loadUser } = useAuth();
  const [form, setForm] = useState({ name: "", phone: "", locality: "" });
  const [prevUser, setPrevUser] = useState(user);
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  if (user !== prevUser) {
    setPrevUser(user);
    setForm({ name: user?.name || "", phone: user?.phone || "", locality: user?.locality || "" });
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (avatarFile) {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => fd.append(k, v));
        fd.append("avatar", avatarFile);
        await api.put("/users/profile", fd, { headers: { "Content-Type": "multipart/form-data" } });
      } else {
        await api.put("/users/profile", form);
      }
      await loadUser();
      setAvatarFile(null);
      setAvatarPreview(null);
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
          <label className="cursor-pointer relative group">
            <Avatar src={avatarPreview || user?.avatar} name={user?.name} size="lg" />
            <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-xs font-semibold">Change</span>
            </div>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} className="hidden" />
          </label>
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
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone</label>
          <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Locality</label>
          <input type="text" value={form.locality} onChange={(e) => setForm({ ...form, locality: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200" />
        </div>
        <button type="submit" disabled={saving} className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all duration-300 hover:-translate-y-0.5">
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
