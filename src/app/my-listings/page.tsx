"use client";

import React, { useState } from "react";
import { Button, Loader } from "@/components/crt";
import { InscriptionCard, ListingForm } from "@/components/marketplace";
import { useInscriptions } from "@/hooks/useInscriptions";
import { useListings } from "@/hooks/useListings";
import { useWallet } from "@/hooks/useWallet";
import { cancelListing, deriveNostrKeypair, getNostrKeyDerivationMessage } from "@/lib/nostr";
import type { InscriptionData } from "@/lib/ordinals";
import type { ListingWithNostr } from "@/lib/nostr";
import { formatBtc, formatSats, truncateInscriptionId, formatTimeAgo } from "@/utils/format";
import { useRouter } from "next/navigation";
import config from "../../../marketplace.config";

export default function MyListingsPage() {
  const router = useRouter();
  const { connected, adapter, ordinalsAddress } = useWallet();
  const { inscriptions, loading: inscLoading, error: inscError, refreshInscriptions } = useInscriptions();
  const { listings, loading: listLoading, refreshListings, getListingForInscription } = useListings();

  const [selectedInscription, setSelectedInscription] = useState<InscriptionData | null>(null);
  const [listFormOpen, setListFormOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"owned" | "listed">("owned");

  // My active listings
  const myListings = listings.filter((l) => l.sellerAddress === ordinalsAddress);

  // Owned inscriptions that are not currently listed
  const unlistedInscriptions = inscriptions.filter(
    (i) => !myListings.some((l) => l.inscriptionId === i.inscriptionId)
  );

  const handleListClick = (inscription: InscriptionData) => {
    setSelectedInscription(inscription);
    setListFormOpen(true);
  };

  const handleCancelListing = async (listing: ListingWithNostr) => {
    if (!adapter || !ordinalsAddress) return;

    setCancellingId(listing.inscriptionId);
    setCancelError(null);

    try {
      // Derive Nostr keypair
      const nostrMessage = getNostrKeyDerivationMessage();
      const { signature } = await adapter.signMessage({
        address: ordinalsAddress,
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
        <div className="text-crt-bright text-sm">MY LAVA LAMPS</div>
        <div className="text-crt-dim text-xs mt-1">
          MANAGE YOUR COLLECTION AND LISTINGS
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
                INSCRIPTIONS FROM THE {config.collection.name.toUpperCase()} COLLECTION
                WILL APPEAR HERE
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
          {myListings.length === 0 ? (
            <div className="text-center py-8 font-mono">
              <div className="text-crt-dim text-sm">NO ACTIVE LISTINGS</div>
              <div className="text-crt-dim text-xs mt-2">
                SWITCH TO &quot;OWNED&quot; VIEW TO LIST YOUR INSCRIPTIONS
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {myListings.map((listing) => (
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
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => router.push(`/item/${encodeURIComponent(listing.inscriptionId)}`)}
                    >
                      VIEW
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
          isOpen={listFormOpen}
          onClose={() => {
            setListFormOpen(false);
            setSelectedInscription(null);
          }}
          onComplete={() => {
            setListFormOpen(false);
            setSelectedInscription(null);
            refreshListings();
            refreshInscriptions();
          }}
        />
      )}
    </div>
  );
}
