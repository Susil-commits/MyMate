import { HiExclamation } from "react-icons/hi";

export default function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", variant = "danger", loading, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onCancel} />
 <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full animate-scale-in">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            variant === "danger" ? "bg-red-100 text-red-600 " :
            variant === "warning" ? "bg-yellow-100 text-yellow-600 " :
            variant === "success" ? "bg-green-100 text-green-600 " :
            "bg-blue-100 text-blue-600 "
          }`}>
            <HiExclamation className="w-6 h-6" />
          </div>
          <div className="flex-1">
 <h3 className="text-lg font-bold text-gray-900 ">{title}</h3>
 <p className="text-sm text-gray-500 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            disabled={loading}
 className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 transition-all duration-200"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
 className={`flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all duration-200 ${
            variant === "danger" ? "bg-red-600 hover:bg-red-700" :
            variant === "warning" ? "bg-yellow-600 hover:bg-yellow-700" :
            variant === "success" ? "bg-green-600 hover:bg-green-700" :
            "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </span>
            ) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
