"use client";

import React, { useState, useEffect } from "react";
import { truncateAddress } from "@/utils/format";

interface StatusBarProps {
  walletAddress?: string;
  walletType?: string;
  blockHeight?: number;
  network?: string;
  connected?: boolean;
  className?: string;
}

export default function StatusBar({
  walletAddress,
  walletType,
  blockHeight,
  network = "MAINNET",
  connected = false,
  className = "",
}: StatusBarProps) {
  const [clock, setClock] = useState("");

  useEffect(() => {
    const updateClock = () =>
      setClock(new Date().toLocaleTimeString("en-US", { hour12: false }));
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`crt-status-bar border-t-2 border-crt px-3 py-1 flex items-center justify-between font-mono text-xs ${className}`}
    >
      {/* Left side — wallet info */}
      <div className="flex items-center gap-4">
        {connected && walletAddress ? (
          <>
            <span className="text-crt-dim">WALLET:</span>
            <span className="text-crt">
              {truncateAddress(walletAddress)}
            </span>
            {walletType && (
              <span className="text-crt-dim">
                ({walletType.toUpperCase()})
              </span>
            )}
            <span className="text-green-500">CONNECTED</span>
          </>
        ) : (
          <span className="text-crt-dim">WALLET: NOT CONNECTED</span>
        )}
      </div>

      {/* Right side — network info */}
      <div className="flex items-center gap-4">
        {blockHeight && (
          <>
            <span className="text-crt-dim">BLOCK:</span>
            <span className="text-crt">{blockHeight.toLocaleString()}</span>
          </>
        )}
        <span className="text-crt-dim">{network}</span>
        <span className="text-crt-dim">{clock}</span>
      </div>
    </div>
  );
}
