"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "./useWallet";
import {
  deriveNostrKeypair,
  getNostrKeyDerivationMessage,
  queryTimelocks,
  type TimelockRecord,
} from "@/lib/nostr";
import { loadTimelocks } from "@/lib/timelock/storage";
import type { TimelockEncryptedContent } from "@/lib/nostr/timelock-schema";

/**
 * Hook for fetching and merging timelocks from Nostr relays + localStorage.
 *
 * Merges both sources, deduplicating by lockTxid:lockVout.
 * Nostr data takes precedence over localStorage (more authoritative).
 */
export function useTimelocks() {
  const { adapter, ordinalsAddress, paymentAddress } = useWallet();
  const [timelocks, setTimelocks] = useState<TimelockRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTimelocks = useCallback(async () => {
    if (!adapter || !ordinalsAddress || !paymentAddress) {
      setTimelocks([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Load from localStorage (instant, no network)
      const localTimelocks = loadTimelocks(ordinalsAddress);

      // Convert localStorage entries to TimelockRecord format (no Nostr metadata)
      const localRecords: TimelockRecord[] = localTimelocks.map((t) => ({
        ...t,
        nostrEventId: "",
        nostrPubkey: "",
      }));

      // Show localStorage data immediately
      setTimelocks(localRecords);

      // Step 2: Try to fetch from Nostr (may fail if not signed yet)
      try {
        const nostrMessage = getNostrKeyDerivationMessage();
        const { signature: nostrSig } = await adapter.signMessage({
          address: paymentAddress,
          message: nostrMessage,
        });
        const { privateKey: nostrPrivateKey } = deriveNostrKeypair(nostrSig);

        const nostrTimelocks = await queryTimelocks(nostrPrivateKey);

        // Merge: Nostr takes precedence, localStorage fills gaps
        const merged = mergeTimelocks(nostrTimelocks, localRecords);
        setTimelocks(merged);
      } catch (nostrErr) {
        console.warn("[useTimelocks] Nostr fetch failed, using localStorage only:", nostrErr);
        // Keep localStorage data if Nostr fails
      }
    } catch (err) {
      console.error("[useTimelocks] Failed to fetch timelocks:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch timelocks");
    } finally {
      setLoading(false);
    }
  }, [adapter, ordinalsAddress, paymentAddress]);

  // Auto-fetch on mount and when wallet changes.
  // Calls fetchTimelocks() which loads localStorage immediately (no signing),
  // then prompts the wallet to sign the Nostr key derivation message and
  // queries Nostr relays to merge any remotely-stored timelocks. This ensures
  // a second device with the same wallet key can see timelocks created elsewhere.
  useEffect(() => {
    if (ordinalsAddress && adapter) {
      fetchTimelocks();
    } else {
      setTimelocks([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordinalsAddress, adapter]);

  return {
    timelocks,
    loading,
    error,
    refetch: fetchTimelocks,
  };
}

/**
 * Merge Nostr and localStorage timelocks.
 * Deduplicates by lockTxid:lockVout. Nostr records take priority.
 */
function mergeTimelocks(
  nostrRecords: TimelockRecord[],
  localRecords: TimelockRecord[]
): TimelockRecord[] {
  const byKey = new Map<string, TimelockRecord>();

  // Add localStorage records first (lower priority)
  for (const record of localRecords) {
    const key = `${record.lockTxid}:${record.lockVout}`;
    byKey.set(key, record);
  }

  // Overwrite with Nostr records (higher priority)
  for (const record of nostrRecords) {
    const key = `${record.lockTxid}:${record.lockVout}`;
    byKey.set(key, record);
  }

  return Array.from(byKey.values()).sort((a, b) => b.createdAt - a.createdAt);
}
