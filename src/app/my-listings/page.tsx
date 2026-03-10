"use client";

import React, { useMemo, useState } from "react";
import { Button, Loader } from "@/components/crt";
import { InscriptionCard, ListingForm } from "@/components/marketplace";
import { useInscriptions, type InscriptionScope } from "@/hooks/useInscriptions";
import { useListings } from "@/hooks/useListings";
import { useWallet } from "@/hooks/useWallet";
import { cancelListing, deriveNostrKeypair, getNostrKeyDerivationMessage, type MarketScope } from "@/lib/nostr";
import { isCollectionInscription, type InscriptionData } from "@/lib/ordinals";
import type { ListingWithNostr } from "@/lib/nostr";
import { formatBtc, formatSats, truncateInscriptionId, formatTimeAgo } from "@/utils/format";
import { useRouter } from "next/navigation";
import config from "../../../marketplace.config";

export default function MyListingsPage() {
  const router = useRouter();
  const { connected, adapter, ordinalsAddress, paymentAddress } = useWallet();
  const [marketScope, setMarketScope] = useState<InscriptionScope>("lava-lamps");
  const { inscriptions, loading: inscLoading, error: inscError, refreshInscriptions } = useInscriptions(marketScope);
  const { listings, loading: listLoading, refreshListings, getListingForInscription } = useListings(
    marketScope === "all" ? "all" : marketScope
  );

  const [selectedInscription, setSelectedInscription] = useState<InscriptionData | null>(null);
  const [selectedMarketScope, setSelectedMarketScope] = useState<MarketScope>("lava-lamps");
  const [initialListPriceSats, setInitialListPriceSats] = useState<number | undefined>(undefined);
  const [listFormOpen, setListFormOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"owned" | "listed">("owned");
  const [listingSearch, setListingSearch] = useState("");
  const [listingSort, setListingSort] = useState<"recent" | "price-asc" | "price-desc">("recent");

  // My active listings
  const myListings = listings.filter((l) => l.sellerAddress === ordinalsAddress);

  // Owned inscriptions that are not currently listed
  const unlistedInscriptions = inscriptions.filter(
    (i) => !myListings.some((l) => l.inscriptionId === i.inscriptionId)
  );

  const handleListClick = (inscription: InscriptionData) => {
    const openListingForm = async () => {
      const inferredScope: MarketScope = marketScope === "all-ordinals"
        ? "all-ordinals"
        : marketScope === "lava-lamps"
        ? "lava-lamps"
        : (await isCollectionInscription(inscription))
        ? "lava-lamps"
        : "all-ordinals";

      setSelectedMarketScope(inferredScope);
      setInitialListPriceSats(undefined);
      setSelectedInscription(inscription);
      setListFormOpen(true);
    };

    void openListingForm();
  };

  const handleCancelListing = async (listing: ListingWithNostr) => {
    if (!adapter || !ordinalsAddress) return;

    setCancellingId(listing.inscriptionId);
    setCancelError(null);

    try {
      // Derive Nostr keypair
      const nostrMessage = getNostrKeyDerivationMessage();
      const { signature } = await adapter.signMessage({
        address: paymentAddress!,
        message: nostrMessage,
      });
      const { privateKey } = deriveNostrKeypair(signature);

      // Publish cancellation (NIP-33 replacement + NIP-09 deletion)
      await cancelListing(listing.nostrEventId, listing.inscriptionId, listing.collectionSlug, privateKey);

      // Refresh listings
      await refreshListings();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Failed to cancel listing");
    } finally {
      setCancellingId(null);
    }
  };

  const handleBulkCancel = async () => {
    if (!adapter || !paymentAddress || visibleListings.length === 0) return;

    setCancelError(null);

    try {
      const nostrMessage = getNostrKeyDerivationMessage();
      const { signature } = await adapter.signMessage({
        address: paymentAddress,
        message: nostrMessage,
      });
      const { privateKey } = deriveNostrKeypair(signature);

      for (const listing of visibleListings) {
        setCancellingId(listing.inscriptionId);
        await cancelListing(
          listing.nostrEventId,
          listing.inscriptionId,
          listing.collectionSlug,
          privateKey
        );
      }

      await refreshListings();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Failed to bulk cancel listings");
    } finally {
      setCancellingId(null);
    }
  };

  const visibleListings = useMemo(() => {
    const query = listingSearch.trim().toLowerCase();
    const filtered = myListings.filter((listing) => {
      if (!query) return true;

      return (
        listing.inscriptionId.toLowerCase().includes(query) ||
        listing.utxo.toLowerCase().includes(query) ||
        (listing.contentType || "").toLowerCase().includes(query)
      );
    });

    return filtered.sort((a, b) => {
      switch (listingSort) {
        case "price-asc":
          return a.priceSats - b.priceSats;
        case "price-desc":
          return b.priceSats - a.priceSats;
        case "recent":
        default:
          return b.listedAt - a.listedAt;
      }
    });
  }, [myListings, listingSearch, listingSort]);

  const dashboardStats = useMemo(() => {
    const listedValueSats = myListings.reduce((sum, listing) => sum + listing.priceSats, 0);

    return {
      owned: inscriptions.length,
      listed: myListings.length,
      unlisted: unlistedInscriptions.length,
      listedValueSats,
    };
  }, [inscriptions.length, myListings, unlistedInscriptions.length]);

  if (!connected) {
    return (
      <div className="space-y-4 font-mono text-center py-12">
        <pre className="text-crt-dim text-xs leading-tight inline-block text-left">
{`
  ┌─────────────────────────────────────┐
  │                                     │
  │   WALLET NOT CONNECTED              │
  │                                     │
  │   CONNECT YOUR WALLET TO VIEW       │
  │   YOUR LAVA LAMPS AND MANAGE        │
  │   YOUR LISTINGS.                    │
  │                                     │
  └─────────────────────────────────────┘
`}
        </pre>
      </div>
    );
  }

  const loading = inscLoading || listLoading;

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="border-b border-crt-dim pb-2 font-mono">
        <div className="text-crt-bright text-sm">MY ORDINALS</div>
        <div className="text-crt-dim text-xs mt-1">
          MANAGE YOUR LAVA LAMPS, OTHER INSCRIPTIONS, AND ACTIVE LISTINGS
        </div>
      </div>

      <div className="flex items-center gap-2 font-mono text-xs">
        <span className="text-crt-dim">MARKET:</span>
        {([
          { key: "lava-lamps", label: "LAVA LAMPS" },
          { key: "all-ordinals", label: "OTHER ORDINALS" },
          { key: "all", label: "ALL" },
        ] as const).map((opt) => (
          <button
            key={opt.key}
            onClick={() => setMarketScope(opt.key)}
            className={`px-2 py-0.5 cursor-pointer ${
              marketScope === opt.key
                ? "bg-crt text-crt-bg"
                : "text-crt-dim hover:text-crt"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-xs">
        <div className="border border-crt-border p-2">
          <div className="text-crt-dim">OWNED</div>
          <div className="text-crt-bright text-sm">{dashboardStats.owned}</div>
        </div>
        <div className="border border-crt-border p-2">
          <div className="text-crt-dim">LISTED</div>
          <div className="text-crt-bright text-sm">{dashboardStats.listed}</div>
        </div>
        <div className="border border-crt-border p-2">
          <div className="text-crt-dim">UNLISTED</div>
          <div className="text-crt-bright text-sm">{dashboardStats.unlisted}</div>
        </div>
        <div className="border border-crt-border p-2">
          <div className="text-crt-dim">ASK VALUE</div>
          <div className="text-crt-bright text-sm">{formatBtc(dashboardStats.listedValueSats)} BTC</div>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2 font-mono text-xs">
        <span className="text-crt-dim">VIEW:</span>
        <button
          onClick={() => setViewMode("owned")}
          className={`px-2 py-0.5 cursor-pointer ${
            viewMode === "owned"
              ? "bg-crt text-crt-bg"
              : "text-crt-dim hover:text-crt"
          }`}
        >
          OWNED ({inscriptions.length})
        </button>
        <button
          onClick={() => setViewMode("listed")}
          className={`px-2 py-0.5 cursor-pointer ${
            viewMode === "listed"
              ? "bg-crt text-crt-bg"
              : "text-crt-dim hover:text-crt"
          }`}
        >
          MY LISTINGS ({myListings.length})
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Loader text="SCANNING WALLET" variant="cursor" />
        </div>
      )}

      {inscError && (
        <div className="border border-crt-error p-3 font-mono text-xs">
          <span className="text-crt-error">ERROR: {inscError}</span>
        </div>
      )}

      {cancelError && (
        <div className="border border-crt-error p-3 font-mono text-xs">
          <span className="text-crt-error">CANCEL ERROR: {cancelError}</span>
          <button
            onClick={() => setCancelError(null)}
            className="text-crt-dim ml-2 hover:text-crt cursor-pointer"
          >
            [DISMISS]
          </button>
        </div>
      )}

      {/* Owned inscriptions view */}
      {viewMode === "owned" && !loading && (
        <>
          {inscriptions.length === 0 ? (
            <div className="text-center py-8 font-mono">
              <div className="text-crt-dim text-sm">NO INSCRIPTIONS FOUND</div>
              <div className="text-crt-dim text-xs mt-2">
                {marketScope === "lava-lamps"
                  ? `INSCRIPTIONS FROM THE ${config.collection.name.toUpperCase()} COLLECTION WILL APPEAR HERE`
                  : marketScope === "all-ordinals"
                  ? "NON-LAVA INSCRIPTIONS YOU OWN WILL APPEAR HERE"
                  : "ALL INSCRIPTIONS YOU OWN WILL APPEAR HERE"}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {inscriptions.map((inscription) => {
                const listing = getListingForInscription(inscription.inscriptionId);
                return (
                  <div key={inscription.inscriptionId} className="relative">
                    <InscriptionCard
                      inscriptionId={inscription.inscriptionId}
                      inscriptionNumber={inscription.inscriptionNumber}
                      listing={listing}
                      isOwned={true}
                      onClick={() => {
                        if (listing) {
                          router.push(`/item/${encodeURIComponent(inscription.inscriptionId)}`);
                        } else {
                          handleListClick(inscription);
                        }
                      }}
                    />
                    {!listing && (
                      <div className="mt-1">
                        <Button
                          variant="primary"
                          onClick={() => handleListClick(inscription)}
                          className="w-full text-xs"
                        >
                          LIST FOR SALE
                        </Button>
                      </div>
                    )}
                    {listing && (
                      <div className="mt-1 text-center">
                        <span className="text-crt text-xs font-mono text-glow">
                          LISTED: {formatBtc(listing.priceSats)} BTC
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* My listings view */}
      {viewMode === "listed" && !loading && (
        <>
          <div className="flex flex-col md:flex-row md:items-end gap-3 border border-crt-border/40 p-3 font-mono text-xs">
            <div className="flex-1">
              <div className="text-crt-dim mb-1">SEARCH LISTINGS</div>
              <input
                value={listingSearch}
                onChange={(e) => setListingSearch(e.target.value)}
                placeholder="INSCRIPTION ID, UTXO, OR CONTENT TYPE"
                className="w-full bg-transparent border border-crt-dim text-crt font-mono text-xs px-2 py-2 outline-none placeholder:text-crt-border"
              />
            </div>
            <div>
              <div className="text-crt-dim mb-1">SORT</div>
              <select
                value={listingSort}
                onChange={(e) => setListingSort(e.target.value as "recent" | "price-asc" | "price-desc")}
                className="bg-transparent border border-crt-dim text-crt font-mono text-xs px-2 py-2 outline-none"
              >
                <option value="recent">RECENT</option>
                <option value="price-asc">PRICE ASC</option>
                <option value="price-desc">PRICE DESC</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setListingSearch("");
                  setListingSort("recent");
                }}
              >
                RESET
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleBulkCancel}
                disabled={visibleListings.length === 0 || cancellingId !== null}
              >
                BULK CANCEL ({visibleListings.length})
              </Button>
            </div>
          </div>

          {myListings.length === 0 ? (
            <div className="text-center py-8 font-mono">
              <div className="text-crt-dim text-sm">NO ACTIVE LISTINGS</div>
              <div className="text-crt-dim text-xs mt-2">
                SWITCH TO &quot;OWNED&quot; VIEW TO LIST YOUR INSCRIPTIONS
              </div>
            </div>
          ) : visibleListings.length === 0 ? (
            <div className="text-center py-8 font-mono">
              <div className="text-crt-dim text-sm">NO LISTINGS MATCH SEARCH</div>
              <div className="text-crt-dim text-xs mt-2">
                TRY A DIFFERENT INSCRIPTION ID, UTXO, OR CONTENT TYPE
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleListings.map((listing) => (
                <div
                  key={listing.inscriptionId}
                  className="border border-crt-border p-3 font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-crt-bright">
                        {truncateInscriptionId(listing.inscriptionId)}
                      </span>
                      <span className="text-crt text-glow">
                        {formatBtc(listing.priceSats)} BTC
                      </span>
                      <span className="text-crt-dim">
                        ({formatSats(listing.priceSats)} sats)
                      </span>
                    </div>
                    <div className="text-crt-dim">
                      LISTED {formatTimeAgo(listing.listedAt)} | UTXO: {listing.utxo.slice(0, 12)}...
                    </div>
                    <div className="text-crt-dim">
                      TYPE: {listing.contentType || "unknown"} | MARKET: {listing.marketScope === "all-ordinals" ? "OPEN MARKET" : "VERIFIED LAVA"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => router.push(`/item/${encodeURIComponent(listing.inscriptionId)}`)}
                    >
                      VIEW
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const ownedInscription = inscriptions.find(
                          (inscription) => inscription.inscriptionId === listing.inscriptionId
                        );

                        if (!ownedInscription) {
                          setCancelError(
                            `Relist unavailable for ${truncateInscriptionId(listing.inscriptionId)} because the inscription is not currently in your owned wallet view.`
                          );
                          return;
                        }

                        setSelectedMarketScope(
                          listing.marketScope === "all-ordinals" ? "all-ordinals" : "lava-lamps"
                        );
                        setInitialListPriceSats(listing.priceSats);
                        setSelectedInscription(ownedInscription);
                        setListFormOpen(true);
                      }}
                    >
                      RELIST
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => handleCancelListing(listing)}
                      disabled={cancellingId === listing.inscriptionId}
                    >
                      {cancellingId === listing.inscriptionId ? "CANCELLING..." : "CANCEL"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Refresh button */}
      {!loading && (
        <div className="text-center pt-2">
          <Button
            variant="ghost"
            onClick={() => {
              refreshInscriptions();
              refreshListings();
            }}
          >
            REFRESH DATA
          </Button>
        </div>
      )}

      {/* List form modal */}
      {selectedInscription && (
        <ListingForm
          inscription={selectedInscription}
          marketScope={selectedMarketScope}
          initialPriceSats={initialListPriceSats}
          isOpen={listFormOpen}
          onClose={() => {
            setListFormOpen(false);
            setSelectedInscription(null);
            setInitialListPriceSats(undefined);
          }}
          onComplete={() => {
            setListFormOpen(false);
            setSelectedInscription(null);
            setInitialListPriceSats(undefined);
            refreshListings();
            refreshInscriptions();
          }}
        />
      )}
    </div>
  );
}
