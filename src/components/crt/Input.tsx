"use client";

import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  suffix?: string;
  error?: string;
}

export default function Input({
  label,
  suffix,
  error,
  className = "",
  ...props
}: InputProps) {
  return (
    <div className="crt-input-group">
      {label && (
        <label className="block text-crt-dim text-xs uppercase tracking-wider mb-1 font-mono">
          {label}
        </label>
      )}
      <div className="flex items-center border border-crt-dim focus-within:border-crt bg-transparent">
        <span className="text-crt-dim pl-2 font-mono text-sm">&gt;</span>
        <input
          className={`flex-1 bg-transparent text-crt font-mono text-sm px-2 py-1.5 outline-none placeholder:text-crt-border ${className}`}
          {...props}
        />
        {suffix && (
          <span className="text-crt-dim pr-2 font-mono text-xs uppercase">
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p className="text-crt-error text-xs font-mono mt-1">! {error}</p>
      )}
    </div>
  );
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function TextArea({
  label,
  error,
  className = "",
  ...props
}: TextAreaProps) {
  return (
    <div className="crt-input-group">
      {label && (
        <label className="block text-crt-dim text-xs uppercase tracking-wider mb-1 font-mono">
          {label}
        </label>
      )}
      <div className="border border-crt-dim focus-within:border-crt bg-transparent">
        <textarea
          className={`w-full bg-transparent text-crt font-mono text-sm px-2 py-1.5 outline-none placeholder:text-crt-border resize-none ${className}`}
          {...props}
        />
      </div>
      {error && (
        <p className="text-crt-error text-xs font-mono mt-1">! {error}</p>
      )}
    </div>
  );
}
