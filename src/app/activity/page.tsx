"use client";

import React from "react";
import { Loader } from "@/components/crt";
import { useActivity } from "@/hooks/useActivity";
import { formatBtc, truncateAddress, truncateInscriptionId, formatTimeAgo } from "@/utils/format";
import { useRouter } from "next/navigation";

export default function ActivityPage() {
  const router = useRouter();
  const { events, loading, verifying, error } = useActivity();

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="border-b border-crt-dim pb-2 font-mono">
        <div className="text-crt-bright text-sm">ACTIVITY LOG</div>
        <div className="text-crt-dim text-xs mt-1">
          ALL MARKETPLACE LISTINGS AND SALES
          {verifying && (
            <span className="ml-2 text-crt animate-pulse">[ VERIFYING ON-CHAIN... ]</span>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader text="QUERYING NOSTR RELAYS" variant="cursor" />
        </div>
      )}

      {error && (
        <div className="border border-crt-error p-3 font-mono text-xs text-crt-error">
          ERROR: {error}
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="text-center py-12 font-mono">
          <pre className="text-crt-dim text-xs leading-tight inline-block text-left">
{`
  ┌──────────────────────────────────┐
  │                                  │
  │   NO ACTIVITY RECORDED           │
  │                                  │
  │   MARKETPLACE EVENTS WILL        │
  │   APPEAR HERE AS THEY OCCUR.     │
  │                                  │
  └──────────────────────────────────┘
`}
          </pre>
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="space-y-0">
          {/* Column headers */}
          <div className="grid grid-cols-12 gap-2 px-2 py-1 border-b border-crt-dim font-mono text-[10px] text-crt-dim">
            <div className="col-span-1">TYPE</div>
            <div className="col-span-3">INSCRIPTION</div>
            <div className="col-span-2">PRICE</div>
            <div className="col-span-3">SELLER</div>
            <div className="col-span-2">TIME</div>
            <div className="col-span-1"></div>
          </div>

          {events.map((event, idx) => (
            <div
              key={`${event.listing.nostrEventId}-${event.type}`}
              className={`grid grid-cols-12 gap-2 px-2 py-1.5 font-mono text-xs cursor-pointer hover:bg-crt/5 transition-colors ${
                idx % 2 === 0 ? "bg-crt/[0.02]" : ""
              }`}
              onClick={() => router.push(`/item/${encodeURIComponent(event.listing.inscriptionId)}`)}
            >
              <div className="col-span-1">
                {event.type === "SOLD" ? (
                  <span className="text-green-400 border border-green-400/60 px-1 text-[10px]">
                    SOLD
                  </span>
                ) : (
                  <span className="text-crt border border-crt px-1 text-[10px]">
                    LIST
                  </span>
                )}
              </div>
              <div className="col-span-3 text-crt-bright truncate">
                {truncateInscriptionId(event.listing.inscriptionId)}
              </div>
              <div className={`col-span-2 ${event.type === "SOLD" ? "text-green-400" : "text-crt text-glow"}`}>
                {formatBtc(event.listing.priceSats)} BTC
              </div>
              <div className="col-span-3 text-crt-dim truncate">
                {truncateAddress(event.listing.sellerAddress, 6)}
              </div>
              <div className="col-span-2 text-crt-dim">
                {formatTimeAgo(event.listing.listedAt)}
              </div>
              <div className="col-span-1 text-right">
                <span className="text-crt-dim hover:text-crt text-[10px]">
                  VIEW &gt;
                </span>
              </div>
            </div>
          ))}

          {/* Summary */}
          <div className="border-t border-crt-dim mt-2 pt-2 px-2 font-mono text-xs text-crt-dim">
            {events.length} EVENT{events.length !== 1 ? "S" : ""} TOTAL |{" "}
            {events.filter((e) => e.type === "LIST").length} LISTED |{" "}
            {events.filter((e) => e.type === "SOLD").length} SOLD |{" "}
            FLOOR: {events.filter((e) => e.type === "LIST").length > 0
              ? `${formatBtc(Math.min(...events.filter((e) => e.type === "LIST").map((e) => e.listing.priceSats)))} BTC`
              : "---"
            }
          </div>
        </div>
      )}
    </div>
  );
}
