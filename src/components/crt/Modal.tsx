"use client";

import React, { useEffect, useCallback } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: "sm" | "md" | "lg";
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  width = "md",
}: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const widthClasses = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80"
        onClick={onClose}
      />
      {/* Centering wrapper — scrolls when modal exceeds viewport */}
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Modal box */}
        <div
          className={`relative ${widthClasses[width]} w-full border-2 border-crt bg-crt-bg shadow-crt`}
        >
          {/* Title bar */}
          <div className="flex items-center justify-between border-b border-crt px-3 py-1.5">
            <span className="text-crt font-mono text-sm uppercase tracking-wider">
              {title}
            </span>
            <button
              onClick={onClose}
              className="text-crt-dim hover:text-crt font-mono text-sm cursor-pointer"
            >
              [X]
            </button>
          </div>
          {/* Content */}
          <div className="p-4 font-mono text-sm text-crt">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
