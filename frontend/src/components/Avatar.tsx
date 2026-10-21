import React from "react";

export interface AvatarProps {
  src?: string | { url?: string };
  name?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export default function Avatar({
  src,
  name = "",
  size = "md",
  className = "",
}: AvatarProps): React.ReactElement {
  const sizes: Record<string, string> = {
    sm: "w-8 h-8 text-xs",
    md: "w-12 h-12 text-base",
    lg: "w-16 h-16 text-xl",
    xl: "w-28 h-28 text-4xl",
  };
  const sizeClass = sizes[size] || sizes.md;
  const url = typeof src === "string" ? src : src?.url;

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        loading="lazy"
        className={`${sizeClass} rounded-2xl object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold ${className}`}
    >
      {name.charAt(0) || "?"}
    </div>
  );
}
