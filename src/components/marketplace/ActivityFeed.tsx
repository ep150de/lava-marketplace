"use client";

import React from "react";
import { formatBtc, formatTimeAgo, truncateAddress } from "@/utils/format";
import type { ListingWithNostr } from "@/lib/nostr";

interface ActivityFeedProps {
  listings: ListingWithNostr[];
  maxItems?: number;
  className?: string;
}

export default function ActivityFeed({
  listings,
  maxItems = 10,
  className = "",
}: ActivityFeedProps) {
  // Show most recent listings as activity
  const recent = listings.slice(0, maxItems);

  return (
    <div className={`${className}`}>
      <div className="border-t border-b border-crt-dim py-1 px-1 mb-2">
        <span className="text-crt-dim text-xs font-mono">
          ─── RECENT ACTIVITY ─────────────────────────────────
        </span>
      </div>

      {recent.length === 0 ? (
        <div className="text-crt-dim text-xs font-mono px-1">
          &gt; NO RECENT ACTIVITY
        </div>
      ) : (
        <div className="space-y-0.5">
          {recent.map((listing) => (
            <div
              key={listing.nostrEventId}
              className="flex items-center gap-2 text-xs font-mono px-1 py-0.5 hover:bg-crt/5"
            >
              <span className="text-crt-dim">&gt;</span>
              <span className="text-crt">
                {listing.inscriptionId.slice(0, 8)}...
              </span>
              <span className="text-crt-dim">LISTED at</span>
              <span className="text-crt-bright text-glow">
                {formatBtc(listing.priceSats)} BTC
              </span>
              <span className="text-crt-dim">by</span>
              <span className="text-crt">
                {truncateAddress(listing.sellerAddress, 4)}
              </span>
              <span className="text-crt-dim ml-auto">
                {formatTimeAgo(listing.listedAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
