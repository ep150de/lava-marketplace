"use client";

import React from "react";
import config from "../../../marketplace.config";

interface FooterProps {
  className?: string;
}

export default function Footer({ className = "" }: FooterProps) {
  return (
    <footer className={`font-mono text-xs text-crt-dim border-t border-crt-dim ${className}`}>
      <div className="px-4 py-3 space-y-2">
        {/* Separator */}
        <div className="text-center text-crt-border">
          ════════════════════════════════════════════════════
        </div>

        {/* Info */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span className="text-crt">{config.marketplace.name}</span>
            <span className="text-crt-border"> | </span>
            <span>OPEN SOURCE ORDINALS MARKETPLACE</span>
          </div>
          <div className="flex items-center gap-3">
            <span>MARKETPLACE FEE: {config.marketplace.feePercent}%</span>
            <span className="text-crt-border">|</span>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-crt"
            >
              [GITHUB]
            </a>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="text-center text-[10px] text-crt-border">
          USE AT YOUR OWN RISK. THIS SOFTWARE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTY.
          ALWAYS VERIFY TRANSACTIONS BEFORE SIGNING.
        </div>

        {/* White-label notice */}
        <div className="text-center text-[10px] text-crt-border">
          FORK THIS MARKETPLACE — CUSTOMIZE marketplace.config.ts — LAUNCH YOUR OWN
        </div>
      </div>
    </footer>
  );
}
