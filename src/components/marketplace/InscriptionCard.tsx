"use client";

import React from "react";
import { formatBtc, formatSats } from "@/utils/format";
import { getInscriptionPreviewUrl } from "@/lib/ordinals";
import type { ListingWithNostr } from "@/lib/nostr";

interface InscriptionCardProps {
  inscriptionId: string;
  inscriptionNumber?: number;
  listing?: ListingWithNostr;
  isOwned?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function InscriptionCard({
  inscriptionId,
  inscriptionNumber,
  listing,
  isOwned = false,
  onClick,
  className = "",
}: InscriptionCardProps) {
  const isListed = !!listing;
  const previewUrl = getInscriptionPreviewUrl(inscriptionId);

  return (
    <div
      onClick={onClick}
      className={`inscription-card cursor-pointer group ${className}`}
    >
      {/* Image preview */}
      <div className="card-image aspect-square relative">
        <iframe
          src={previewUrl}
          title={`Inscription ${inscriptionId}`}
          className="w-full h-full"
          sandbox="allow-scripts allow-same-origin"
          loading="lazy"
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-crt-bg/60 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
          <span className="text-crt text-sm font-mono text-glow">
            {isListed ? "[ VIEW LISTING ]" : isOwned ? "[ LIST FOR SALE ]" : "[ VIEW ]"}
          </span>
        </div>
      </div>

      {/* Card info */}
      <div className="p-2 space-y-1">
        {/* Inscription number */}
        <div className="flex items-center justify-between">
          <span className="text-crt-bright text-xs font-mono">
            #{inscriptionNumber || "???"}
          </span>
          {isOwned && (
            <span className="text-[10px] text-crt-dim border border-crt-dim px-1">
              OWNED
            </span>
          )}
        </div>

        {/* Price or status */}
        <div className="font-mono">
          {isListed && listing ? (
            <div className="flex items-center justify-between">
              <span className="text-crt text-sm text-glow">
                {formatBtc(listing.priceSats)} BTC
              </span>
              <span className="text-[10px] text-crt-dim">
                {formatSats(listing.priceSats)} sats
              </span>
            </div>
          ) : (
            <span className="text-crt-dim text-xs">UNLISTED</span>
          )}
        </div>

        {/* Action hint */}
        {isListed && (
          <div className="text-center">
            <span className="text-crt text-xs border border-crt px-2 py-0.5 group-hover:bg-crt group-hover:text-crt-bg transition-all duration-100">
              BUY
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
