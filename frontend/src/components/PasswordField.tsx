import { useState, InputHTMLAttributes, forwardRef, ReactNode } from "react";
import { HiEye, HiEyeOff } from "react-icons/hi";

export interface PasswordFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  containerClassName?: string;
  matchSuccess?: boolean;
  accentColor?: "blue" | "green" | "purple" | "gray";
}

const ACCENT_STYLES = {
  blue: {
    focusRing: "focus:ring-blue-500/20 focus:border-blue-500",
  },
  green: {
    focusRing: "focus:ring-green-500/20 focus:border-green-500",
  },
  purple: {
    focusRing: "focus:ring-purple-500/20 focus:border-purple-500",
  },
  gray: {
    focusRing: "focus:ring-gray-500/20 focus:border-gray-500",
  },
};

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  (
    {
      id,
      label,
      error,
      helperText,
      leftIcon,
      className = "",
      containerClassName = "",
      matchSuccess,
      accentColor = "blue",
      disabled,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    const accent = ACCENT_STYLES[accentColor] || ACCENT_STYLES.blue;

    let borderAndRingClass = `border-gray-200 ${accent.focusRing}`;
    if (error) {
      borderAndRingClass = "border-red-500 focus:ring-red-500/20 focus:border-red-500 text-red-900";
    } else if (matchSuccess) {
      borderAndRingClass = "border-emerald-500 focus:ring-emerald-500/20 focus:border-emerald-500";
    }

    return (
      <div className={`w-full ${containerClassName}`}>
        {label && (
          <label htmlFor={inputId} className="block text-sm font-semibold text-gray-700 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex items-center justify-center">
              {leftIcon}
            </div>
          )}
          <input
            {...props}
            ref={ref}
            id={inputId}
            disabled={disabled}
            type={showPassword ? "text" : "password"}
            className={`w-full ${leftIcon ? "pl-11" : "pl-4"} pr-11 py-3 bg-gray-50 border ${borderAndRingClass} rounded-xl text-gray-900 placeholder:text-gray-400 focus:ring-2 outline-none transition-all duration-200 text-sm ${className}`}
          />
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors p-1 flex items-center justify-center rounded-lg hover:bg-gray-100"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <HiEyeOff className="w-5 h-5 text-gray-500" />
            ) : (
              <HiEye className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>
        {error && <p className="text-red-500 text-xs mt-1.5 font-medium">{error}</p>}
        {!error && matchSuccess && (
          <p className="text-emerald-600 text-xs mt-1.5 font-medium flex items-center gap-1">
            <span>✓</span> Passwords match
          </p>
        )}
        {!error && !matchSuccess && helperText && (
          <p className="text-gray-400 text-xs mt-1.5">{helperText}</p>
        )}
      </div>
    );
  }
);

PasswordField.displayName = "PasswordField";

export default PasswordField;
