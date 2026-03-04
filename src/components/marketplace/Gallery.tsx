"use client";

import React, { useState } from "react";
import InscriptionCard from "./InscriptionCard";
import { Loader } from "@/components/crt";
import type { ListingWithNostr } from "@/lib/nostr";
import type { InscriptionData } from "@/lib/ordinals";

interface GalleryProps {
  listings: ListingWithNostr[];
  ownedInscriptions?: InscriptionData[];
  loading?: boolean;
  error?: string | null;
  onItemClick?: (inscriptionId: string) => void;
  collectionFilter?: "lava-lamps" | "all";
  onCollectionFilterChange?: (filter: "lava-lamps" | "all") => void;
  className?: string;
}

export default function Gallery({
  listings,
  ownedInscriptions = [],
  loading = false,
  error = null,
  onItemClick,
  collectionFilter = "lava-lamps",
  onCollectionFilterChange,
  className = "",
}: GalleryProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"price-asc" | "price-desc" | "recent">(
    "recent"
  );

  // Build a map of owned inscription IDs
  const ownedIds = new Set(
    ownedInscriptions.map((i) => i.inscriptionId)
  );

  // Sort listings
  const sortedListings = [...listings].sort((a, b) => {
    switch (sortBy) {
      case "price-asc":
        return a.priceSats - b.priceSats;
      case "price-desc":
        return b.priceSats - a.priceSats;
      case "recent":
      default:
        return b.listedAt - a.listedAt;
    }
  });

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader text="LOADING INSCRIPTIONS" variant="cursor" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-crt-error p-4 text-center font-mono">
        <p className="text-crt-error text-sm">ERROR: {error}</p>
        <p className="text-crt-dim text-xs mt-2">
          CHECK YOUR CONNECTION AND TRY AGAIN
        </p>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {/* Controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-2 border-b border-crt-border">
        <div className="font-mono text-xs text-crt-dim">
          {sortedListings.length} LISTED
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          {/* Collection filter */}
          {onCollectionFilterChange && (
            <div className="flex items-center gap-1">
              <span className="text-crt-dim">COLLECTION:</span>
              {(
                [
                  { key: "lava-lamps", label: "LAVA LAMPS" },
                  { key: "all", label: "ALL" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => onCollectionFilterChange(opt.key)}
                  className={`px-1.5 py-0.5 cursor-pointer ${
                    collectionFilter === opt.key
                      ? "bg-crt text-crt-bg"
                      : "text-crt-dim hover:text-crt"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Sort */}
          <div className="flex items-center gap-1">
            <span className="text-crt-dim">SORT:</span>
            {(
              [
                { key: "recent", label: "RECENT" },
                { key: "price-asc", label: "PRICE+" },
                { key: "price-desc", label: "PRICE-" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={`px-1.5 py-0.5 cursor-pointer ${
                  sortBy === opt.key
                    ? "bg-crt text-crt-bg"
                    : "text-crt-dim hover:text-crt"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* View mode */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-1.5 py-0.5 cursor-pointer ${
                viewMode === "grid"
                  ? "bg-crt text-crt-bg"
                  : "text-crt-dim hover:text-crt"
              }`}
            >
              GRID
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-1.5 py-0.5 cursor-pointer ${
                viewMode === "list"
                  ? "bg-crt text-crt-bg"
                  : "text-crt-dim hover:text-crt"
              }`}
            >
              LIST
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      {sortedListings.length === 0 ? (
        <div className="text-center py-12 font-mono">
          <pre className="text-crt-dim text-xs leading-tight">
{`
  ┌──────────────────────────────┐
  │                              │
  │   NO LISTINGS FOUND          │
  │                              │
  │   BE THE FIRST TO LIST       │
  │   YOUR LAVA LAMP!            │
  │                              │
  └──────────────────────────────┘
`}
          </pre>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {sortedListings.map((listing) => (
            <InscriptionCard
              key={listing.inscriptionId}
              inscriptionId={listing.inscriptionId}
              listing={listing}
              isOwned={ownedIds.has(listing.inscriptionId)}
              onClick={() => onItemClick?.(listing.inscriptionId)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {sortedListings.map((listing) => (
            <div
              key={listing.inscriptionId}
              onClick={() => onItemClick?.(listing.inscriptionId)}
              className="flex items-center justify-between border border-crt-border/30 px-3 py-2 font-mono text-xs hover:border-crt hover:bg-crt/5 cursor-pointer transition-all duration-100"
            >
              <div className="flex items-center gap-4">
                <span className="text-crt-bright">
                  {listing.inscriptionId.slice(0, 8)}...
                </span>
                <span className="text-crt-dim">
                  {listing.contentType || "unknown"}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-crt text-glow">
                  {(listing.priceSats / 100_000_000).toFixed(8)} BTC
                </span>
                {ownedIds.has(listing.inscriptionId) ? (
                  <span className="text-crt-dim border border-crt-dim px-2 py-0.5">
                    LISTED
                  </span>
                ) : (
                  <span className="text-crt border border-crt px-2 py-0.5 hover:bg-crt hover:text-crt-bg">
                    BUY
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
