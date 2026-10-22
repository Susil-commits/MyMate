import "./leaflet-setup.js";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// Reset chunk reload guard on successful initial mount
if (typeof window !== "undefined") {
  window.sessionStorage.removeItem("chunk_load_failed_retry");

  // Vite's built-in event when a dynamically imported asset fails to fetch
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    const hasRetried = window.sessionStorage.getItem("chunk_load_failed_retry");
    if (!hasRetried) {
      window.sessionStorage.setItem("chunk_load_failed_retry", "true");
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((r) => r.update());
        });
      }
      window.location.reload();
    }
  });
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find root element");

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
