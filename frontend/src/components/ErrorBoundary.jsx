import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";
import { HiExclamationCircle } from "react-icons/hi";

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="text-center p-10 max-w-md w-full">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <HiExclamationCircle className="w-10 h-10 text-red-500 dark:text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Something went wrong</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6 break-words">{error?.message || "An unexpected error occurred"}</p>
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

export default function ErrorBoundary({ children }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Reset state here if needed
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
