"use client";

import React from "react";
import { useWallet } from "@/hooks/useWallet";
import { truncateAddress } from "@/utils/format";

interface WalletBadgeProps {
  className?: string;
}

export default function WalletBadge({ className = "" }: WalletBadgeProps) {
  const { connected, type, ordinalsAddress, paymentAddress } = useWallet();

  if (!connected || !ordinalsAddress) return null;

  return (
    <div className={`font-mono text-xs ${className}`}>
      <div className="border border-crt-dim px-3 py-2 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-green-500">&#9679;</span>
          <span className="text-crt-bright">{type?.toUpperCase()}</span>
          <span className="text-crt-dim">CONNECTED</span>
        </div>
        <div className="pl-4 space-y-0.5">
          <div>
            <span className="text-crt-dim">ORD: </span>
            <span className="text-crt">{truncateAddress(ordinalsAddress, 8)}</span>
          </div>
          {paymentAddress && paymentAddress !== ordinalsAddress && (
            <div>
              <span className="text-crt-dim">PAY: </span>
              <span className="text-crt">{truncateAddress(paymentAddress, 8)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
