import { useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function TwoFactorSettings() {
  const { user, loadUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [token, setToken] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/2fa/generate");
      setSetupData(data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to initiate 2FA setup");
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async (e) => {
    e.preventDefault();
    if (!token || token.length < 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }
    setLoading(true);
    try {
      await api.post("/2fa/enable", { token });
      toast.success("Two-Factor Authentication enabled successfully!");
      setSetupData(null);
      await loadUser(); // Refresh user state to reflect isTwoFactorEnabled
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to verify token");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Two-Factor Authentication</h2>
          <p className="text-sm text-gray-500 mt-1">
            Add an extra layer of security to your account.
          </p>
        </div>
        {user?.isTwoFactorEnabled ? (
          <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full">
            Enabled
          </span>
        ) : (
          <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-semibold rounded-full">
            Disabled
          </span>
        )}
      </div>

      {!user?.isTwoFactorEnabled && !setupData && (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Generating..." : "Set up 2FA"}
        </button>
      )}

      {setupData && (
        <div className="mt-6 p-6 border border-gray-100 rounded-xl bg-gray-50 space-y-6">
          <div className="text-center">
            <h3 className="font-semibold text-gray-900 mb-2">Scan this QR Code</h3>
            <p className="text-sm text-gray-500 mb-4">
              Open your authenticator app (e.g., Google Authenticator, Authy) and scan the QR code below.
            </p>
            <div className="bg-white p-4 inline-block rounded-xl shadow-sm mb-4">
              <img src={setupData.qrCodeUrl} alt="2FA QR Code" className="w-48 h-48 mx-auto" />
            </div>
            <p className="text-xs text-gray-400">
              Can't scan the code? Enter this secret manually: <strong className="text-gray-700 block mt-1 tracking-wider">{setupData.secret}</strong>
            </p>
          </div>
          
          <form onSubmit={handleEnable} className="max-w-xs mx-auto">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5 text-center">
              Verify Setup Code
            </label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="000000"
              maxLength={6}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200 text-center tracking-[0.5em] text-lg font-bold mb-4"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black disabled:opacity-50 transition-colors"
            >
              {loading ? "Verifying..." : "Verify & Enable"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
