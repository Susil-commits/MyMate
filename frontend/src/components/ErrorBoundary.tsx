import { ReactNode } from "react";
import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from "react-error-boundary";
import { HiExclamationCircle } from "react-icons/hi";

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const errorMsg = (error as any)?.message || String(error);
  const isChunkError =
    errorMsg.includes("Failed to fetch dynamically imported module") ||
    errorMsg.includes("Expected a JavaScript-or-Wasm module script") ||
    errorMsg.includes("Importing a module script failed") ||
    errorMsg.includes("error loading dynamically imported module");

  if (isChunkError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
        <div className="text-center p-10 max-w-md w-full">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <HiExclamationCircle className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Update Available</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            A new version of MyMate was deployed. Please refresh to load the latest version.
          </p>
          <button
            onClick={() => {
              if ("serviceWorker" in navigator) {
                navigator.serviceWorker.getRegistrations().then((registrations) => {
                  registrations.forEach((r) => r.update());
                });
              }
              window.location.reload();
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all duration-200"
          >
            Refresh Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="text-center p-10 max-w-md w-full">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <HiExclamationCircle className="w-10 h-10 text-red-500 dark:text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Something went wrong</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6 break-words">{errorMsg || "An unexpected error occurred"}</p>
        <button
          onClick={() => {
            resetErrorBoundary();
            window.location.href = "/";
          }}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all duration-200"
        >
          Go Home
        </button>
      </div>
    </div>
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

export default function ErrorBoundary({ children }: ErrorBoundaryProps) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error) => {
        const msg = (error as any)?.message || String(error);
        const isChunkError =
          msg.includes("Failed to fetch dynamically imported module") ||
          msg.includes("Expected a JavaScript-or-Wasm module script") ||
          msg.includes("Importing a module script failed");

        if (isChunkError) {
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
        }
      }}
      onReset={() => {
        // Reset state here if needed
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
