"use client";

import React from "react";
import { formatBtc, formatTimeAgo, truncateAddress } from "@/utils/format";
import type { ListingWithNostr } from "@/lib/nostr";
import type { ActivityEvent } from "@/hooks/useActivity";

interface ActivityFeedProps {
  /** Pass raw listings (will be shown as LIST events) OR pre-annotated ActivityEvent[] */
  listings?: ListingWithNostr[];
  events?: ActivityEvent[];
  maxItems?: number;
  className?: string;
}

export default function ActivityFeed({
  listings,
  events: rawEvents,
  maxItems = 10,
  className = "",
}: ActivityFeedProps) {
  // Normalize: if raw listings provided, convert to ActivityEvent[]
  const events: ActivityEvent[] = rawEvents
    ? rawEvents.slice(0, maxItems)
    : (listings || [])
        .sort((a, b) => b.listedAt - a.listedAt)
        .slice(0, maxItems)
        .map((listing) => ({
          type: "LIST" as const,
          listing,
          timestamp: listing.listedAt,
        }));

  return (
    <div className={`${className}`}>
      <div className="border-t border-b border-crt-dim py-1 px-1 mb-2">
        <span className="text-crt-dim text-xs font-mono">
          ─── RECENT ACTIVITY ─────────────────────────────────
        </span>
      </div>

      {events.length === 0 ? (
        <div className="text-crt-dim text-xs font-mono px-1">
          &gt; NO RECENT ACTIVITY
        </div>
      ) : (
        <div className="space-y-0.5">
          {events.map((event) => (
            <div
              key={`${event.listing.nostrEventId}-${event.type}`}
              className="flex items-center gap-2 text-xs font-mono px-1 py-0.5 hover:bg-crt/5"
            >
              <span className="text-crt-dim">&gt;</span>
              <span className="text-crt">
                {event.listing.inscriptionId.slice(0, 8)}...
              </span>
              {event.type === "SOLD" ? (
                <>
                  <span className="text-green-400">SOLD at</span>
                  <span className="text-green-400">
                    {formatBtc(event.listing.priceSats)} BTC
                  </span>
                </>
              ) : (
                <>
                  <span className="text-crt-dim">LISTED at</span>
                  <span className="text-crt-bright text-glow">
                    {formatBtc(event.listing.priceSats)} BTC
                  </span>
                </>
              )}
              <span className="text-crt-dim">by</span>
              <span className="text-crt">
                {truncateAddress(event.listing.sellerAddress, 4)}
              </span>
              <span className="text-crt-dim ml-auto">
                {formatTimeAgo(event.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
