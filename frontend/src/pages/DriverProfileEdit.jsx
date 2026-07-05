import { useState } from "react";
import BackButton from "../components/BackButton";
import Avatar from "../components/Avatar";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { vehicleTypes } from "../utils/constants";
import toast from "react-hot-toast";

export default function DriverProfileEdit() {
  const { user, loadUser } = useAuth();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    nationality: "",
    locality: "",
    experienceYears: "",
    hourlyRate: "",
    dailyRate: "",
    bio: "",
    availability: "available",
    vehicleTypes: [],
    languages: "",
  });
  const [prevUser, setPrevUser] = useState(user);
  const [licenseFile, setLicenseFile] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  if (user !== prevUser) {
    setPrevUser(user);
    setForm({
      name: user.name || "",
      phone: user.phone || "",
      nationality: user.nationality || "",
      locality: user.locality || "",
      experienceYears: user.experienceYears || "",
      hourlyRate: user.hourlyRate || "",
      dailyRate: user.dailyRate || "",
      bio: user.bio || "",
      availability: user.availability || "available",
      vehicleTypes: user.vehicleTypes || [],
      languages: (user.languages || []).join(", "),
    });
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleVehicleToggle = (type) => {
    setForm((prev) => ({
      ...prev,
      vehicleTypes: prev.vehicleTypes.includes(type)
        ? prev.vehicleTypes.filter((t) => t !== type)
        : [...prev.vehicleTypes, type],
    }));
  };

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
      const formData = new FormData();
      Object.entries(form).forEach(([key, val]) => {
        if (key === "vehicleTypes") {
          val.forEach((v) => formData.append("vehicleTypes", v));
        } else if (key === "languages") {
          formData.append("languages", val);
        } else {
          formData.append(key, val);
        }
      });
      if (licenseFile) {
        formData.append("licenseImage", licenseFile);
        formData.append("resubmitKyc", "true");
      }
      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }

      await api.put("/drivers/profile", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
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
    <div className="max-w-2xl mx-auto animate-fade-in">
      <BackButton to="/driver/dashboard" label="Back to Dashboard" />
      <h1 className="text-3xl font-extrabold text-gray-900">
        Edit <span className="gradient-text">Profile</span>
      </h1>

      {user?.kycStatus === "rejected" && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-2xl p-5 animate-slide-in-left">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-800">KYC Verification Rejected</p>
              <p className="text-sm text-red-600 mt-0.5">Your document verification was rejected. Please update your license image and contact support if needed. Your profile will be re-submitted for review after saving.</p>
            </div>
          </div>
        </div>
      )}

      {user?.kycStatus === "pending" && user?.profileCompleted && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-2xl p-5 animate-slide-in-left">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-yellow-800">KYC Verification Pending</p>
              <p className="text-sm text-yellow-600 mt-0.5">Your documents are being reviewed. You'll be notified once approved.</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-5">
        <div className="flex items-center gap-4 pb-5 border-b border-gray-100">
          <label className="cursor-pointer relative group">
            <Avatar src={avatarPreview || user?.avatar} name={user?.name} size="lg" className="from-green-500 to-teal-600" />
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

 <div className="grid grid-cols-1 md gap-4">
          <Field label="Name" name="name" value={form.name} onChange={handleChange} />
          <Field label="Phone" name="phone" value={form.phone} onChange={handleChange} />
          <Field label="Nationality" name="nationality" value={form.nationality} onChange={handleChange} />
          <Field label="Locality" name="locality" value={form.locality} onChange={handleChange} />
          <Field label="Experience (years)" name="experienceYears" type="number" value={form.experienceYears} onChange={handleChange} />
          <Field label="Hourly Rate ($)" name="hourlyRate" type="number" value={form.hourlyRate} onChange={handleChange} />
          <Field label="Daily Rate ($)" name="dailyRate" type="number" value={form.dailyRate} onChange={handleChange} />
        </div>

        <Field label="Languages (comma separated)" name="languages" value={form.languages} onChange={handleChange} />

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Availability</label>
 <select name="availability" value={form.availability} onChange={handleChange} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200">
            <option value="available">Available</option>
            <option value="busy">Busy</option>
            <option value="offline">Offline</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Vehicle Types</label>
          <div className="flex flex-wrap gap-2">
            {vehicleTypes.map((type) => (
              <button key={type} type="button" onClick={() => handleVehicleToggle(type)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${
                  form.vehicleTypes.includes(type)
                    ? "bg-green-600 text-white border-green-600 shadow-sm"
 : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}>
                {type}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Update License Image</label>
 <input type="file" accept="image/*,.pdf" onChange={(e) => setLicenseFile(e.target.files[0])} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Bio</label>
 <textarea name="bio" value={form.bio} onChange={handleChange} maxLength={500} rows={3} placeholder="Tell customers about yourself..." className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none transition-all duration-200" />
        </div>

 <button type="submit" disabled={saving} className="w-full py-3.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition-all duration-300 hover:-translate-y-0.5">
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </span>
          ) : (
            "Save Changes"
          )}
        </button>
      </form>
    </div>
  );
}

function Field({ label, name, type = "text", value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
 <input type={type} name={name} value={value} onChange={onChange} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200" />
    </div>
  );
}
