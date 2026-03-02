"use client";

import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: React.ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses = "crt-button font-mono uppercase tracking-wider transition-all duration-100 cursor-pointer select-none";

  const variantClasses = {
    primary:
      "border-2 border-crt text-crt hover:bg-crt hover:text-crt-bg active:bg-crt-bright active:text-crt-bg",
    secondary:
      "border border-crt-dim text-crt-dim hover:border-crt hover:text-crt active:bg-crt-dim active:text-crt-bg",
    danger:
      "border-2 border-crt-error text-crt-error hover:bg-crt-error hover:text-crt-bg active:bg-red-600 active:text-crt-bg",
    ghost:
      "border border-transparent text-crt-dim hover:text-crt hover:border-crt-dim",
  };

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-4 py-1.5 text-sm",
    lg: "px-6 py-2 text-base",
  };

  const disabledClasses = disabled || loading
    ? "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-crt-dim"
    : "";

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="crt-spinner">&#9608;</span>
          {children}
        </span>
      ) : (
        <>[ {children} ]</>
      )}
    </button>
  );
}
