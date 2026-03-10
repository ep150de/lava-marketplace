"use client";

import React, { useMemo, useState } from "react";
import InscriptionCard from "./InscriptionCard";
import { Button, Input, Loader } from "@/components/crt";
import type { ListingQueryScope, ListingWithNostr } from "@/lib/nostr";
import type { InscriptionData } from "@/lib/ordinals";

type SortMode = "price-asc" | "price-desc" | "recent";
type ContentTypeFilter = "all" | "image" | "text" | "html" | "json" | "other";
type PriceBandFilter = "all" | "under-0.001" | "0.001-0.01" | "over-0.01";
type ProvenanceFilter = "all" | "verified-lava" | "open-market";

interface GalleryProps {
  listings: ListingWithNostr[];
  ownedInscriptions?: InscriptionData[];
  loading?: boolean;
  error?: string | null;
  onItemClick?: (inscriptionId: string) => void;
  collectionFilter?: ListingQueryScope;
  onCollectionFilterChange?: (filter: ListingQueryScope) => void;
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
  const [sortBy, setSortBy] = useState<SortMode>("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter>("all");
  const [priceBandFilter, setPriceBandFilter] = useState<PriceBandFilter>("all");
  const [provenanceFilter, setProvenanceFilter] = useState<ProvenanceFilter>("all");

  // Build a map of owned inscription IDs
  const ownedIds = new Set(
    ownedInscriptions.map((i) => i.inscriptionId)
  );

  const filteredListings = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return listings.filter((listing) => {
      if (normalizedQuery) {
        const matchesQuery =
          listing.inscriptionId.toLowerCase().includes(normalizedQuery) ||
          (listing.contentType || "").toLowerCase().includes(normalizedQuery);

        if (!matchesQuery) return false;
      }

      if (contentTypeFilter !== "all") {
        const contentType = (listing.contentType || "").toLowerCase();
        const matchesContentType =
          (contentTypeFilter === "image" && contentType.startsWith("image/")) ||
          (contentTypeFilter === "text" && contentType.startsWith("text/")) ||
          (contentTypeFilter === "html" && contentType.includes("html")) ||
          (contentTypeFilter === "json" && contentType.includes("json")) ||
          (
            contentTypeFilter === "other" &&
            contentType !== "" &&
            !contentType.startsWith("image/") &&
            !contentType.startsWith("text/") &&
            !contentType.includes("html") &&
            !contentType.includes("json")
          );

        if (!matchesContentType) return false;
      }

      if (priceBandFilter !== "all") {
        const btc = listing.priceSats / 100_000_000;
        const matchesPriceBand =
          (priceBandFilter === "under-0.001" && btc < 0.001) ||
          (priceBandFilter === "0.001-0.01" && btc >= 0.001 && btc <= 0.01) ||
          (priceBandFilter === "over-0.01" && btc > 0.01);

        if (!matchesPriceBand) return false;
      }

      if (provenanceFilter !== "all") {
        const isOpenMarket = listing.marketScope === "all-ordinals" || listing.collectionSlug === "all-ordinals";
        const matchesProvenance =
          (provenanceFilter === "verified-lava" && !isOpenMarket) ||
          (provenanceFilter === "open-market" && isOpenMarket);

        if (!matchesProvenance) return false;
      }

      return true;
    });
  }, [
    listings,
    searchQuery,
    contentTypeFilter,
    priceBandFilter,
    provenanceFilter,
  ]);

  const sortedListings = useMemo(() => {
    return [...filteredListings].sort((a, b) => {
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
  }, [filteredListings, sortBy]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    contentTypeFilter !== "all" ||
    priceBandFilter !== "all" ||
    provenanceFilter !== "all";

  const showOpenMarketHint = collectionFilter === "all-ordinals" || collectionFilter === "all";

  const emptyStateLabel =
    collectionFilter === "lava-lamps"
      ? "YOUR LAVA LAMP!"
      : collectionFilter === "all-ordinals"
      ? "YOUR ORDINAL!"
      : "YOUR INSCRIPTION!";

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
          {sortedListings.length} MATCHES / {listings.length} LISTED
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          {/* Collection filter */}
          {onCollectionFilterChange && (
            <div className="flex items-center gap-1">
              <span className="text-crt-dim">MARKET:</span>
              {(
                [
                  { key: "lava-lamps", label: "LAVA LAMPS" },
                  { key: "all-ordinals", label: "OTHER ORDINALS" },
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

      <div className="mb-4 space-y-3 border border-crt-border/40 p-3">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_auto_auto_auto_auto] gap-3 items-end">
          <Input
            label="SEARCH"
            placeholder="INSCRIPTION ID OR CONTENT TYPE"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="font-mono text-xs">
            <div className="text-crt-dim mb-1">TYPE</div>
            <select
              value={contentTypeFilter}
              onChange={(e) => setContentTypeFilter(e.target.value as ContentTypeFilter)}
              className="w-full bg-transparent border border-crt-dim text-crt font-mono text-xs px-2 py-2 outline-none"
            >
              <option value="all">ALL TYPES</option>
              <option value="image">IMAGE</option>
              <option value="text">TEXT</option>
              <option value="html">HTML</option>
              <option value="json">JSON</option>
              <option value="other">OTHER</option>
            </select>
          </div>

          <div className="font-mono text-xs">
            <div className="text-crt-dim mb-1">PRICE</div>
            <select
              value={priceBandFilter}
              onChange={(e) => setPriceBandFilter(e.target.value as PriceBandFilter)}
              className="w-full bg-transparent border border-crt-dim text-crt font-mono text-xs px-2 py-2 outline-none"
            >
              <option value="all">ALL PRICES</option>
              <option value="under-0.001">&lt; 0.001 BTC</option>
              <option value="0.001-0.01">0.001-0.01</option>
              <option value="over-0.01">&gt; 0.01 BTC</option>
            </select>
          </div>

          <div className="font-mono text-xs">
            <div className="text-crt-dim mb-1">SOURCE</div>
            <select
              value={provenanceFilter}
              onChange={(e) => setProvenanceFilter(e.target.value as ProvenanceFilter)}
              className="w-full bg-transparent border border-crt-dim text-crt font-mono text-xs px-2 py-2 outline-none"
            >
              <option value="all">ALL</option>
              {collectionFilter !== "all-ordinals" && (
                <option value="verified-lava">VERIFIED LAVA</option>
              )}
              {collectionFilter !== "lava-lamps" && (
                <option value="open-market">OPEN MARKET</option>
              )}
            </select>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setContentTypeFilter("all");
              setPriceBandFilter("all");
              setProvenanceFilter("all");
            }}
            disabled={!hasActiveFilters}
            className="h-[34px]"
          >
            CLEAR FILTERS
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-crt-dim">
          <span>SEARCHES INSCRIPTION ID + CONTENT TYPE</span>
          <span>FILTERS APPLY CLIENT-SIDE</span>
          {showOpenMarketHint && (
            <span>OPEN MARKET FILTERS ACTIVE</span>
          )}
        </div>
      </div>

      {/* Grid */}
      {sortedListings.length === 0 ? (
        <div className="text-center py-12 font-mono">
          <pre className="text-crt-dim text-xs leading-tight">
 {hasActiveFilters ? `
  ┌──────────────────────────────┐
  │                              │
  │   NO MATCHES FOUND           │
  │                              │
  │   TRY WIDER SEARCH OR        │
  │   CLEAR CURRENT FILTERS      │
  │                              │
  └──────────────────────────────┘
` : `
  ┌──────────────────────────────┐
  │                              │
  │   NO LISTINGS FOUND          │
  │                              │
  │   BE THE FIRST TO LIST       │
  │   ${emptyStateLabel.padEnd(28)}│
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
