"use client";

import React from "react";
import { formatBtc } from "@/utils/format";
import { useMarketplaceContext } from "@/context/MarketplaceContext";

interface PriceDisplayProps {
  sats: number;
  showUsd?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function PriceDisplay({
  sats,
  showUsd = true,
  size = "md",
  className = "",
}: PriceDisplayProps) {
  const { btcPrice } = useMarketplaceContext();
  const btc = sats / 100_000_000;
  const usd = btcPrice ? btc * btcPrice : null;

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-lg",
  };

  return (
    <span className={`font-mono text-crt ${sizeClasses[size]} ${className}`}>
      <span className="text-glow">{formatBtc(sats)} BTC</span>
      {showUsd && usd !== null && (
        <span className="text-crt-dim ml-2">
          (${usd.toFixed(2)})
        </span>
      )}
    </span>
  );
}
