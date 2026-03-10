"use client";

import React, { useState } from "react";
import { Gallery, BuyModal, ActivityFeed } from "@/components/marketplace";
import { useListings } from "@/hooks/useListings";
import { useInscriptions } from "@/hooks/useInscriptions";
import { useMarketplaceContext } from "@/context/MarketplaceContext";
import { useWallet } from "@/hooks/useWallet";
import type { ListingQueryScope, ListingWithNostr } from "@/lib/nostr";
import { useRouter } from "next/navigation";
import config from "../../marketplace.config";

export default function HomePage() {
  const router = useRouter();
  const { connected } = useWallet();
  const [marketScope, setMarketScope] = useState<ListingQueryScope>("lava-lamps");
  const { listings, loading, error, refreshListings } = useListings(marketScope);
  const { inscriptions } = useInscriptions("all");
  const { blockHeight, btcPrice } = useMarketplaceContext();

  const [selectedListing, setSelectedListing] = useState<ListingWithNostr | null>(null);
  const [buyModalOpen, setBuyModalOpen] = useState(false);

  const handleItemClick = (inscriptionId: string) => {
    // Check if this inscription has a listing
    const listing = listings.find((l) => l.inscriptionId === inscriptionId);
    if (listing) {
      // Navigate to item detail page
      router.push(`/item/${encodeURIComponent(inscriptionId)}`);
    }
  };

  const handleQuickBuy = (listing: ListingWithNostr) => {
    setSelectedListing(listing);
    setBuyModalOpen(true);
  };

  const handlePurchaseComplete = () => {
    refreshListings();
    setBuyModalOpen(false);
    setSelectedListing(null);
  };

  // Stats
  const totalListings = listings.length;
  const floorPrice = listings.length > 0
    ? Math.min(...listings.map((l) => l.priceSats))
    : 0;
  const isLavaOnly = marketScope === "lava-lamps";
  const isOtherOrdinals = marketScope === "all-ordinals";

  return (
    <div className="space-y-6">
      {/* Market stats bar */}
      <div className="border border-crt-border p-3 font-mono">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <div>
              <span className="text-crt-dim">MARKET: </span>
              <span className="text-crt-bright">
                {isLavaOnly
                  ? config.collection.name.toUpperCase()
                  : isOtherOrdinals
                  ? "OTHER ORDINALS"
                  : "ALL ORDINALS"}
              </span>
            </div>
            {isLavaOnly && (
              <div>
                <span className="text-crt-dim">SUPPLY: </span>
                <span className="text-crt">{config.collection.totalSupply.toLocaleString()}</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <div>
              <span className="text-crt-dim">LISTED: </span>
              <span className="text-crt">{totalListings}</span>
            </div>
            <div>
              <span className="text-crt-dim">FLOOR: </span>
              <span className="text-crt-bright text-glow">
                {floorPrice > 0
                  ? `${(floorPrice / 100_000_000).toFixed(8)} BTC`
                  : "---"}
              </span>
            </div>
            {btcPrice && (
              <div className="hidden sm:block">
                <span className="text-crt-dim">BTC/USD: </span>
                <span className="text-crt">${btcPrice.toLocaleString()}</span>
              </div>
            )}
            {blockHeight && (
              <div className="hidden sm:block">
                <span className="text-crt-dim">BLOCK: </span>
                <span className="text-crt">{blockHeight.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Welcome message if not connected */}
      {!connected && !loading && (
        <div className="border border-crt-border/50 p-4 text-center font-mono">
          <div className="text-crt-bright text-sm mb-2">
            CONNECT YOUR WALLET TO START TRADING
          </div>
          <div className="text-crt-dim text-xs">
            SUPPORTS XVERSE AND UNISAT WALLETS | TRUSTLESS PSBT TRADING | NO CUSTODIAL RISK
          </div>
        </div>
      )}

      {/* Gallery section */}
      <div>
        <div className="border-t border-crt-dim py-1 px-1 mb-3">
          <span className="text-crt-dim text-xs font-mono">
            <span className="hidden sm:inline">─── ACTIVE LISTINGS ─────────────────────────────────</span>
            <span className="inline sm:hidden">── ACTIVE LISTINGS ──</span>
          </span>
        </div>
        <Gallery
          listings={listings}
          ownedInscriptions={inscriptions}
          loading={loading}
          error={error}
          onItemClick={handleItemClick}
          collectionFilter={marketScope}
          onCollectionFilterChange={setMarketScope}
        />
      </div>

      {/* Activity feed */}
      {listings.length > 0 && (
        <ActivityFeed listings={listings} maxItems={5} />
      )}

      {/* Buy modal */}
      {selectedListing && (
        <BuyModal
          listing={selectedListing}
          isOpen={buyModalOpen}
          onClose={() => {
            setBuyModalOpen(false);
            setSelectedListing(null);
          }}
          onComplete={handlePurchaseComplete}
        />
      )}
    </div>
  );
}
