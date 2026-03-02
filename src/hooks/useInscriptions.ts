"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "./useWallet";
import { getCollectionInscriptionsForAddress } from "@/lib/ordinals";
import type { InscriptionData } from "@/lib/ordinals";

/**
 * Hook for fetching the connected user's ordinal inscriptions
 */
export function useInscriptions() {
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
      const results = await getCollectionInscriptionsForAddress(ordinalsAddress);
      setInscriptions(results);
    } catch (err) {
      console.error("Failed to fetch inscriptions:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch inscriptions"
      );
    } finally {
      setLoading(false);
    }
  }, [connected, ordinalsAddress]);

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
