"use client";

import React from "react";

interface LoaderProps {
  text?: string;
  variant?: "cursor" | "dots" | "bar" | "boot";
  className?: string;
}

export default function Loader({
  text = "LOADING",
  variant = "cursor",
  className = "",
}: LoaderProps) {
  if (variant === "cursor") {
    return (
      <div className={`font-mono text-sm text-crt ${className}`}>
        <span>{text}</span>
        <span className="terminal-cursor ml-1">&#9608;</span>
      </div>
    );
  }

  if (variant === "dots") {
    return (
      <div className={`font-mono text-sm text-crt ${className}`}>
        <span>{text}</span>
        <span className="crt-dots" />
      </div>
    );
  }

  if (variant === "bar") {
    return (
      <div className={`font-mono text-sm text-crt ${className}`}>
        <div className="mb-1">{text}</div>
        <div className="border border-crt-dim w-48 h-4 overflow-hidden">
          <div className="crt-progress-bar h-full bg-crt" />
        </div>
      </div>
    );
  }

  // Boot sequence
  return (
    <div className={`font-mono text-sm text-crt space-y-1 ${className}`}>
      <div className="text-crt-bright">LAVA TERMINAL v1.0</div>
      <div className="text-crt-dim">BIOS CHECK.............. OK</div>
      <div className="text-crt-dim">MEMORY TEST............. OK</div>
      <div className="text-crt-dim">WALLET INTERFACE........ OK</div>
      <div className="text-crt-dim">ORDINALS INDEXER........ OK</div>
      <div className="text-crt-dim">NOSTR RELAY CONN........ OK</div>
      <div className="text-crt-dim">PSBT ENGINE............. OK</div>
      <div className="mt-2">
        <span>{text}</span>
        <span className="terminal-cursor ml-1">&#9608;</span>
      </div>
    </div>
  );
}

/**
 * Inline blinking cursor
 */
export function BlinkingCursor({ className = "" }: { className?: string }) {
  return <span className={`terminal-cursor ${className}`}>&#9608;</span>;
}
