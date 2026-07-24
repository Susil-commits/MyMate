import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  // We now use httpOnly cookies for the JWT, so no need to attach the Authorization header manually.
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
        // We still redirect to login page if unauthorized (401)
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