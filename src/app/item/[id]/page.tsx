"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Loader } from "@/components/crt";
import { BuyModal, ListingForm, PriceDisplay } from "@/components/marketplace";
import { useListings } from "@/hooks/useListings";
import { useInscriptions } from "@/hooks/useInscriptions";
import { useWallet } from "@/hooks/useWallet";
import { getInscriptionDetails, getInscriptionPreviewUrl } from "@/lib/ordinals";
import type { InscriptionData } from "@/lib/ordinals";
import type { ListingWithNostr } from "@/lib/nostr";
import { formatBtc, formatSats, truncateAddress, truncateInscriptionId, formatTimeAgo } from "@/utils/format";
import config from "../../../../marketplace.config";

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const inscriptionId = decodeURIComponent(params.id as string);

  const { connected, ordinalsAddress } = useWallet();
  const { listings, getListingForInscription, refreshListings, verifyListing } = useListings();
  const { inscriptions } = useInscriptions();

  const [inscription, setInscription] = useState<InscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [listFormOpen, setListFormOpen] = useState(false);
  const [utxoValid, setUtxoValid] = useState<boolean | null>(null);

  const listing = getListingForInscription(inscriptionId);
  const isOwned = inscriptions.some((i) => i.inscriptionId === inscriptionId);
  const isSeller = listing?.sellerAddress === ordinalsAddress;

  // Fetch inscription details
  useEffect(() => {
    let cancelled = false;
    async function fetchDetails() {
      setLoading(true);
      setError(null);
      try {
        const data = await getInscriptionDetails(inscriptionId);
        if (!cancelled) setInscription(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load inscription");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchDetails();
    return () => { cancelled = true; };
  }, [inscriptionId]);

  // Verify UTXO validity if there's a listing
  useEffect(() => {
    if (listing) {
      verifyListing(listing).then(setUtxoValid);
    }
  }, [listing, verifyListing]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader text="LOADING INSCRIPTION DATA" variant="cursor" />
      </div>
    );
  }

  if (error || !inscription) {
    return (
      <div className="space-y-4 font-mono">
        <div className="border border-crt-error p-6 text-center">
          <div className="text-crt-error text-sm">ERROR: {error || "INSCRIPTION NOT FOUND"}</div>
          <div className="text-crt-dim text-xs mt-2">ID: {truncateInscriptionId(inscriptionId)}</div>
        </div>
        <div className="text-center">
          <Button variant="ghost" onClick={() => router.push("/")}>
            &lt; BACK TO GALLERY
          </Button>
        </div>
      </div>
    );
  }

  const previewUrl = getInscriptionPreviewUrl(inscriptionId);

  return (
    <div className="space-y-4">
      {/* Back nav */}
      <div className="font-mono">
        <button
          onClick={() => router.push("/")}
          className="text-crt-dim text-xs hover:text-crt transition-colors cursor-pointer"
        >
          &lt; BACK TO GALLERY
        </button>
      </div>

      {/* Main content: two-column on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Inscription preview */}
        <div className="space-y-3">
          <div className="border border-crt-border aspect-square relative bg-crt-bg">
            <iframe
              src={previewUrl}
              title={`Inscription ${inscriptionId}`}
              className="w-full h-full"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
          <div className="text-center">
            <a
              href={`https://ordinals.com/inscription/${inscriptionId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-crt-dim text-xs font-mono hover:text-crt"
            >
              [VIEW ON ORDINALS.COM]
            </a>
          </div>
        </div>

        {/* Right: Details & actions */}
        <div className="space-y-4 font-mono">
          {/* Title */}
          <div className="border-b border-crt-dim pb-2">
            <div className="text-crt-bright text-lg">
              {config.collection.name.toUpperCase()}
            </div>
            <div className="text-crt-dim text-xs mt-1">
              #{inscription.inscriptionNumber || "???"}
            </div>
          </div>

          {/* Listing status */}
          {listing ? (
            <div className="border border-crt p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-crt-dim text-xs">CURRENT LISTING</span>
                {utxoValid === false && (
                  <span className="text-crt-error text-xs">UTXO SPENT</span>
                )}
                {utxoValid === true && (
                  <span className="text-green-500 text-xs">VERIFIED</span>
                )}
              </div>
              <div className="text-crt-bright text-2xl text-glow">
                {formatBtc(listing.priceSats)} BTC
              </div>
              <div className="text-crt-dim text-xs">
                {formatSats(listing.priceSats)} sats
              </div>
              <div className="text-crt-dim text-xs">
                SELLER: {truncateAddress(listing.sellerAddress, 8)}
              </div>
              <div className="text-crt-dim text-xs">
                LISTED: {formatTimeAgo(listing.listedAt)}
              </div>

              {/* Actions */}
              <div className="pt-2 space-y-2">
                {connected && !isSeller && utxoValid !== false && (
                  <Button
                    variant="primary"
                    onClick={() => setBuyModalOpen(true)}
                    className="w-full"
                  >
                    BUY NOW - {formatBtc(listing.priceSats)} BTC
                  </Button>
                )}
                {!connected && (
                  <div className="text-crt-dim text-xs text-center border border-crt-border p-2">
                    CONNECT WALLET TO PURCHASE
                  </div>
                )}
                {isSeller && (
                  <div className="text-crt-dim text-xs text-center border border-crt-border p-2">
                    THIS IS YOUR LISTING
                  </div>
                )}
                {utxoValid === false && (
                  <div className="text-crt-error text-xs text-center border border-crt-error p-2">
                    LISTING INVALID — UTXO ALREADY SPENT
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="border border-crt-border/50 p-4 space-y-3">
              <div className="text-crt-dim text-sm">NOT CURRENTLY LISTED</div>
              {isOwned && connected && (
                <Button
                  variant="primary"
                  onClick={() => setListFormOpen(true)}
                  className="w-full"
                >
                  LIST FOR SALE
                </Button>
              )}
              {isOwned && !connected && (
                <div className="text-crt-dim text-xs text-center">
                  CONNECT WALLET TO LIST
                </div>
              )}
            </div>
          )}

          {/* Inscription details */}
          <div className="border border-crt-border p-3 space-y-2 text-xs">
            <div className="text-crt-dim pb-1 border-b border-crt-border/30">
              INSCRIPTION DETAILS
            </div>
            <div className="flex justify-between">
              <span className="text-crt-dim">ID:</span>
              <span className="text-crt">{truncateInscriptionId(inscriptionId, 12)}</span>
            </div>
            {inscription.inscriptionNumber && (
              <div className="flex justify-between">
                <span className="text-crt-dim">NUMBER:</span>
                <span className="text-crt">#{inscription.inscriptionNumber.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-crt-dim">CONTENT TYPE:</span>
              <span className="text-crt">{inscription.contentType || "unknown"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-crt-dim">OUTPUT VALUE:</span>
              <span className="text-crt">{formatSats(inscription.outputValue)} sats</span>
            </div>
            <div className="flex justify-between">
              <span className="text-crt-dim">LOCATION:</span>
              <span className="text-crt text-[10px]">
                {inscription.location.slice(0, 20)}...
              </span>
            </div>
            {inscription.address && (
              <div className="flex justify-between">
                <span className="text-crt-dim">OWNER:</span>
                <span className="text-crt">{truncateAddress(inscription.address, 6)}</span>
              </div>
            )}
          </div>

          {/* Collection info */}
          <div className="border border-crt-border/30 p-3 text-xs">
            <div className="text-crt-dim">
              COLLECTION: {config.collection.name}
            </div>
            <div className="text-crt-dim mt-1">
              ARTIST: {config.collection.artist} | SUPPLY: {config.collection.totalSupply.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Buy modal */}
      {listing && (
        <BuyModal
          listing={listing}
          isOpen={buyModalOpen}
          onClose={() => setBuyModalOpen(false)}
          onComplete={() => {
            setBuyModalOpen(false);
            refreshListings();
          }}
        />
      )}

      {/* List form */}
      {inscription && isOwned && (
        <ListingForm
          inscription={inscription}
          isOpen={listFormOpen}
          onClose={() => setListFormOpen(false)}
          onComplete={() => {
            setListFormOpen(false);
            refreshListings();
          }}
        />
      )}
    </div>
  );
}
