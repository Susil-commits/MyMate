import { ComponentType, lazy, LazyExoticComponent } from "react";

/**
 * Wraps dynamic React.lazy imports with an automatic single reload retry.
 * Handles the common SPA issue where a new production deployment changes chunk hashes
 * while an existing user session still requests obsolete chunk hashes.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return lazy(async () => {
    const storageKey = "chunk_load_failed_retry";
    try {
      return await factory();
    } catch (error: any) {
      const msg = error?.message || String(error);
      const isChunkError =
        msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("Expected a JavaScript-or-Wasm module script") ||
        msg.includes("Importing a module script failed") ||
        msg.includes("error loading dynamically imported module");

      if (isChunkError) {
        const hasRetried = window.sessionStorage.getItem(storageKey);
        if (!hasRetried) {
          window.sessionStorage.setItem(storageKey, "true");
          if ("serviceWorker" in navigator) {
            try {
              const registrations = await navigator.serviceWorker.getRegistrations();
              await Promise.all(registrations.map((reg) => reg.update()));
            } catch {
              // Ignore service worker update error and proceed with reload
            }
          }
          window.location.reload();
          return new Promise(() => {});
        }
      }
      throw error;
    }
  });
}
