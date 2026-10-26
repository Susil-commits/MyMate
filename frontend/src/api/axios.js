import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
});

api.interceptors.request.use((config) => {
  // Ensure XSRF-TOKEN header is attached cross-origin if present in cookies
  if (typeof document !== "undefined") {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
    if (match && match[1]) {
      config.headers = config.headers || {};
      config.headers["X-XSRF-TOKEN"] = decodeURIComponent(match[1]);
    }
  }
  return config;
});

let isRedirecting = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isAuthMe = error.config?.url?.includes("/auth/me");
      if (!isAuthMe && !error.config?.skipAuthRedirect) {
        window.dispatchEvent(new CustomEvent("unauthorized-error"));

        const path = window.location.pathname;
        const isAuthOrPublicPage =
          path.includes("/login") ||
          path.includes("/register") ||
          path.includes("/forgot-password") ||
          path.includes("/reset-password") ||
          path === "/" ||
          path === "/drivers";

        // Only redirect automatically if on a protected route and not already redirecting
        if (!isAuthOrPublicPage && !isRedirecting) {
          isRedirecting = true;
          const login =
            path.startsWith("/driver") ? "/driver/login" :
            path.startsWith("/admin") ? "/admin/login" :
            "/user/login";

          setTimeout(() => {
            isRedirecting = false;
            window.location.href = login;
          }, 800);
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;