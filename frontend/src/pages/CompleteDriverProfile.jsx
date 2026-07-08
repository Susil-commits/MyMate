import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { vehicleTypes } from "../utils/constants";
import toast from "react-hot-toast";

export default function CompleteDriverProfile() {
  const { user, completeProfile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: user?.name || "",
    nationality: user?.nationality || "",
    locality: user?.locality || "",
    licenseNumber: user?.licenseNumber || "",
    experienceYears: user?.experienceYears || "",
    hourlyRate: user?.hourlyRate || "",
    dailyRate: user?.dailyRate || "",
    languages: (user?.languages || []).join(", "),
    bio: user?.bio || "",
    vehicleTypes: user?.vehicleTypes || [],
  });
  const [licenseFile, setLicenseFile] = useState(null);
  const [saving, setSaving] = useState(false);

  if (user?.profileCompleted) {
    return <Navigate to="/driver/dashboard" replace />;
  }

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleVehicleToggle = (type) => {
    setForm((prev) => ({
      ...prev,
      vehicleTypes: prev.vehicleTypes.includes(type)
        ? prev.vehicleTypes.filter((t) => t !== type)
        : [...prev.vehicleTypes, type],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, val]) => {
        if (key === "vehicleTypes") val.forEach((v) => formData.append("vehicleTypes", v));
        else if (key === "languages") formData.append("languages", val);
        else formData.append(key, val);
      });
      if (licenseFile) formData.append("licenseImage", licenseFile);

      await completeProfile("/auth/driver/complete-profile", formData);
      toast.success("Profile submitted for verification!");
      navigate("/driver/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to complete profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-teal-50 px-4 py-8">
      <div className="max-w-lg w-full animate-fade-up">
        <div className="backdrop-blur-xl bg-white/70 rounded-3xl shadow-xl shadow-black/5 border border-white/50 p-8">
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Complete Driver Profile</h1>
          <p className="text-gray-500 mb-6">Submit your details for verification.</p>

          <form onSubmit={handleSubmit} encType="multipart/form-data" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name" name="name" value={form.name} onChange={handleChange} required />
              <Field label="Nationality" name="nationality" value={form.nationality} onChange={handleChange} required />
            </div>
            <Field label="Locality" name="locality" value={form.locality} onChange={handleChange} required />
            <Field label="License Number" name="licenseNumber" value={form.licenseNumber} onChange={handleChange} required />
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">License Image (required)</label>
 <input type="file" accept="image/*,.pdf" required={!user?.licenseImage?.url} onChange={(e) => setLicenseFile(e.target.files[0])} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Experience (yrs)" name="experienceYears" type="number" value={form.experienceYears} onChange={handleChange} required />
              <Field label="Hourly Rate (₹)" name="hourlyRate" type="number" value={form.hourlyRate} onChange={handleChange} required />
              <Field label="Daily Rate (₹)" name="dailyRate" type="number" value={form.dailyRate} onChange={handleChange} required />
            </div>
            <Field label="Languages (comma separated)" name="languages" value={form.languages} onChange={handleChange} />
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Vehicle Types</label>
              <div className="flex flex-wrap gap-2">
                {vehicleTypes.map((type) => (
 <button key={type} type="button" onClick={() => handleVehicleToggle(type)} className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${form.vehicleTypes.includes(type) ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>{type}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Bio</label>
 <textarea name="bio" value={form.bio} onChange={handleChange} maxLength={500} rows={3} placeholder="Tell customers about yourself..." className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none transition-all duration-200" />
            </div>
 <button type="submit" disabled={saving} className="w-full py-3.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition-all duration-300">
              {saving ? "Submitting..." : "Submit for Verification"}
            </button>
            <p className="text-xs text-center text-gray-400">Your profile will be reviewed by our team before going live.</p>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, name, type = "text", value, onChange, required }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
 <input type={type} name={name} value={value} onChange={onChange} required={required} className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200" />
    </div>
  );
}
