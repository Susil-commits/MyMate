import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/reset-password", { token, password, role });
      localStorage.setItem("token", data.token);
      toast.success("Password reset successfully");
      navigate(role === "driver" ? "/driver/dashboard" : "/drivers");
    } catch (err) {
      toast.error(err.response?.data?.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white p-4">
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-10 max-w-md w-full animate-fade-in">
        <h2 className="text-2xl font-extrabold text-gray-900 text-center">Set New Password</h2>
        <p className="text-gray-500 text-sm text-center mt-1">Enter your new password</p>

        <div className="flex gap-2 mt-6 mb-5">
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20 disabled:opacity-50 transition-all duration-300"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <p className="text-center mt-5 text-sm text-gray-500">
          <Link to="/user/login" className="text-blue-600 font-semibold hover:underline">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}