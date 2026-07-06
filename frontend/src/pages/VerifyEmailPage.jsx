import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "../api/axios";
import { FaCar } from "react-icons/fa";
import toast from "react-hot-toast";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const role = searchParams.get("role");
  const [status, setStatus] = useState(token && role ? "verifying" : "missing");

  useEffect(() => {
    if (!token || !role) return;
    const verify = async () => {
      try {
        await api.post("/auth/verify-email", { token, role });
        setStatus("success");
        toast.success("Email verified! You can now log in.");
      } catch (err) {
        setStatus("error");
        toast.error(err.response?.data?.message || "Verification failed");
      }
    };
    verify();
  }, [token, role]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-center animate-fade-up">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-6">
          <FaCar className="text-white text-2xl" />
        </div>
        {status === "verifying" ? (
          <>
            <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Verifying Email...</h1>
            <p className="text-gray-500">Please wait a moment.</p>
            <div className="mt-6 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-200 border-t-blue-600" />
            </div>
          </>
        ) : status === "success" ? (
          <>
            <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Email Verified!</h1>
            <p className="text-gray-500 mb-6">Your email has been verified. You can now log in to your account.</p>
            <Link to={role === "driver" ? "/driver/login" : "/user/login"} className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all duration-200">
              Go to Login
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Verification Failed</h1>
            <p className="text-gray-500 mb-6">The verification link is invalid or has expired. You can request a new one.</p>
            <Link to={role === "driver" ? "/driver/login" : "/user/login"} className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all duration-200">
              Back to Login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
