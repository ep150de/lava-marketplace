"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useListings } from "./useListings";
import { verifyUtxoUnspent } from "@/lib/psbt";
import type { ListingWithNostr } from "@/lib/nostr";

export type ActivityEventType = "LIST" | "SOLD";

export interface ActivityEvent {
  type: ActivityEventType;
  listing: ListingWithNostr;
  /** Unix timestamp (seconds) — listedAt for LIST events, same for SOLD (best we have) */
  timestamp: number;
}

/**
 * Hook for building an activity feed from Nostr listings + on-chain UTXO state.
 *
 * Fetches ALL listings (including spent ones) via useListings with skipUtxoVerification,
 * then batch-checks each listing's UTXO to annotate as LIST (active) or SOLD (spent).
 *
 * This produces two event types per sold inscription:
 *   - LIST event (at the original listedAt time)
 *   - SOLD event (same timestamp — we don't have the exact sale time without parsing the spending tx)
 */
export function useActivity() {
  const { listings: allListings, loading, error, refreshListings } = useListings(
    undefined,
    { skipUtxoVerification: true }
  );

  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [verifying, setVerifying] = useState(false);
  const verifyAbortRef = useRef(0);

  const annotateListings = useCallback(async (listings: ListingWithNostr[]) => {
    if (listings.length === 0) {
      setEvents([]);
      return;
    }

    // Immediately show all as LIST events while verifying
    setEvents(
      listings.map((listing) => ({
        type: "LIST" as ActivityEventType,
        listing,
        timestamp: listing.listedAt,
      }))
    );

    const verifyId = ++verifyAbortRef.current;
    setVerifying(true);

    try {
      const results = await Promise.allSettled(
        listings.map(async (listing) => {
          const [txid, voutStr] = listing.utxo.split(":");
          const vout = parseInt(voutStr, 10);
          const unspent = await verifyUtxoUnspent(txid, vout);
          return { listing, unspent };
        })
      );

      if (verifyAbortRef.current !== verifyId) return;

      const annotatedEvents: ActivityEvent[] = [];

      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const { listing, unspent } = result.value;

        // Always add the LIST event
        annotatedEvents.push({
          type: "LIST",
          listing,
          timestamp: listing.listedAt,
        });

        // If the UTXO is spent, also add a SOLD event
        if (!unspent) {
          annotatedEvents.push({
            type: "SOLD",
            listing,
            // Use listedAt as a rough timestamp — the sale happened after this
            timestamp: listing.listedAt,
          });
        }
      }

      // Sort by timestamp descending, with SOLD events after their LIST event
      // (for same timestamp, SOLD comes first so it appears higher in the feed)
      annotatedEvents.sort((a, b) => {
        if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
        // Same timestamp: SOLD before LIST so it shows as more recent
        if (a.type === "SOLD" && b.type === "LIST") return -1;
        if (a.type === "LIST" && b.type === "SOLD") return 1;
        return 0;
      });

      setEvents(annotatedEvents);
    } catch (err) {
      console.error("Activity UTXO annotation error:", err);
      // On failure, keep the LIST-only events (already set above)
    } finally {
      if (verifyAbortRef.current === verifyId) {
        setVerifying(false);
      }
    }
  }, []);

  useEffect(() => {
    annotateListings(allListings);
  }, [allListings, annotateListings]);

  return {
    events,
    loading,
    verifying,
    error,
    refreshActivity: refreshListings,
  };
}
