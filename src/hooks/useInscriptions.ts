"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "./useWallet";
import {
  getCollectionInscriptionsForAddress,
  getInscriptionsForAddress,
  isCollectionInscription,
} from "@/lib/ordinals";
import type { InscriptionData } from "@/lib/ordinals";

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
          const checks = await Promise.all(
            allInscriptions.map(async (inscription) => ({
              inscription,
              isCollection: await isCollectionInscription(inscription),
            }))
          );

          results = checks
            .filter((entry) => !entry.isCollection)
            .map((entry) => entry.inscription);
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
