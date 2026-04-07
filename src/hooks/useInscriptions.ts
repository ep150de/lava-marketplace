"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "./useWallet";
import {
  getCollectionInscriptionsForAddress,
  getInscriptionsForAddress,
  isCollectionInscription,
  fetchInscriptionSummariesBatch,
} from "@/lib/ordinals";
import type { InscriptionData } from "@/lib/ordinals";
import config from "../../marketplace.config";

export type InscriptionScope = "lava-lamps" | "all-ordinals" | "all";

/**
 * Hook for fetching the connected user's ordinal inscriptions
 */
export function useInscriptions(scope: InscriptionScope = "lava-lamps") {
  const { connected, ordinalsAddress } = useWallet();
  const [inscriptions, setInscriptions] = useState<InscriptionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInscriptions = useCallback(async () => {
    if (!connected || !ordinalsAddress) {
      setInscriptions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let results: InscriptionData[];

      if (scope === "lava-lamps") {
        results = await getCollectionInscriptionsForAddress(ordinalsAddress);
      } else {
        const allInscriptions = await getInscriptionsForAddress(ordinalsAddress);

        if (scope === "all") {
          results = allInscriptions;
        } else {
          // "all-ordinals" - filter OUT collection items using batch API
          const ids = allInscriptions.map((i) => i.inscriptionId);
          const summaries = await fetchInscriptionSummariesBatch(ids);

          const configParents = new Set(config.collection.parentInscriptionIds);
          const collectionIds = new Set(
            summaries
              .filter((s) => s.parents?.some((p) => configParents.has(p)))
              .map((s) => s.id)
          );

          results = allInscriptions.filter((i) => !collectionIds.has(i.inscriptionId));
        }
      }

      setInscriptions(results);
    } catch (err) {
      console.error("Failed to fetch inscriptions:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch inscriptions"
      );
    } finally {
      setLoading(false);
    }
  }, [connected, ordinalsAddress, scope]);

  useEffect(() => {
    fetchInscriptions();
  }, [fetchInscriptions]);

  return {
    inscriptions,
    loading,
    error,
    refreshInscriptions: fetchInscriptions,
  };
}
