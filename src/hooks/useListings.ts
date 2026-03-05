"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { queryListings, type ListingWithNostr } from "@/lib/nostr";
import { verifyUtxoUnspent } from "@/lib/psbt";
import config from "../../marketplace.config";

interface UseListingsOptions {
  /** Skip on-chain UTXO verification (for activity feed that needs all listings including sold). Default: false */
  skipUtxoVerification?: boolean;
}

/**
 * Hook for fetching and managing active listings from Nostr relays.
 * Applies "optimistic then filter" pattern: shows all Nostr listings immediately,
 * then async-verifies each listing's UTXO on-chain and removes spent ones.
 * @param collectionFilter - "all" to show all collections, or a specific slug (defaults to config slug)
 * @param options - { skipUtxoVerification } to disable UTXO filtering (e.g. for activity page)
 */
export function useListings(collectionFilter?: "all" | string, options?: UseListingsOptions) {
  const [listings, setListings] = useState<ListingWithNostr[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verifyAbortRef = useRef(0);

  const slug = collectionFilter === "all" ? null : (collectionFilter ?? config.collection.slug);
  const skipVerify = options?.skipUtxoVerification ?? false;

  const fetchListings = useCallback(async () => {
    try {
      setError(null);
      const results = await queryListings(slug);

      // Optimistic: show all listings immediately
      setListings(results);

      // Then verify UTXOs on-chain and filter out spent ones (unless skipped)
      if (!skipVerify && results.length > 0) {
        const verifyId = ++verifyAbortRef.current;
        setVerifying(true);

        try {
          const verifyResults = await Promise.allSettled(
            results.map(async (listing) => {
              const [txid, voutStr] = listing.utxo.split(":");
              const vout = parseInt(voutStr, 10);
              const unspent = await verifyUtxoUnspent(txid, vout);
              return { listing, unspent };
            })
          );

          // Only update if this is still the latest verify pass
          if (verifyAbortRef.current === verifyId) {
            const verified = verifyResults
              .filter(
                (r): r is PromiseFulfilledResult<{ listing: ListingWithNostr; unspent: boolean }> =>
                  r.status === "fulfilled" && r.value.unspent
              )
              .map((r) => r.value.listing);

            setListings(verified);
          }
        } catch (err) {
          console.error("UTXO verification error:", err);
          // On verification failure, keep the optimistic listings — better to show
          // a potentially-stale listing than to hide valid ones
        } finally {
          if (verifyAbortRef.current === verifyId) {
            setVerifying(false);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch listings:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch listings");
    } finally {
      setLoading(false);
    }
  }, [slug, skipVerify]);

  // Initial fetch
  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchListings, 30000);
    return () => clearInterval(interval);
  }, [fetchListings]);

  /**
   * Verify a listing's UTXO is still unspent
   */
  const verifyListing = useCallback(
    async (listing: ListingWithNostr): Promise<boolean> => {
      const [txid, voutStr] = listing.utxo.split(":");
      const vout = parseInt(voutStr, 10);
      return verifyUtxoUnspent(txid, vout);
    },
    []
  );

  /**
   * Get listing for a specific inscription
   */
  const getListingForInscription = useCallback(
    (inscriptionId: string): ListingWithNostr | undefined => {
      return listings.find((l) => l.inscriptionId === inscriptionId);
    },
    [listings]
  );

  return {
    listings,
    loading,
    verifying,
    error,
    refreshListings: fetchListings,
    verifyListing,
    getListingForInscription,
  };
}
