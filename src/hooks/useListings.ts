"use client";

import { useState, useEffect, useCallback } from "react";
import { queryListings, type ListingWithNostr } from "@/lib/nostr";
import { verifyUtxoUnspent } from "@/lib/psbt";
import config from "../../marketplace.config";

/**
 * Hook for fetching and managing active listings from Nostr relays.
 * @param collectionFilter - "all" to show all collections, or a specific slug (defaults to config slug)
 */
export function useListings(collectionFilter?: "all" | string) {
  const [listings, setListings] = useState<ListingWithNostr[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const slug = collectionFilter === "all" ? null : (collectionFilter ?? config.collection.slug);

  const fetchListings = useCallback(async () => {
    try {
      setError(null);
      const results = await queryListings(slug);
      setListings(results);
    } catch (err) {
      console.error("Failed to fetch listings:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch listings");
    } finally {
      setLoading(false);
    }
  }, [slug]);

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
    error,
    refreshListings: fetchListings,
    verifyListing,
    getListingForInscription,
  };
}
