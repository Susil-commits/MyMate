import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // For /auth/me calls, let loadUser handle the token cleanup — don't
      // hard-redirect (avoids double-redirect + state loss on cold starts)
      const isAuthMe = error.config?.url?.includes("/auth/me");
      if (!isAuthMe) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        const path = window.location.pathname;
        if (!path.includes("/login")) {
          const login =
            path.startsWith("/driver") ? "/driver/login" :
            path.startsWith("/admin") ? "/admin/login" :
            "/user/login";
          window.location.href = login;
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;