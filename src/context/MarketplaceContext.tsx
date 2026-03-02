"use client";

import React from "react";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { MEMPOOL_API } from "@/utils/constants";

interface MarketplaceState {
  blockHeight: number | null;
  feeRate: number | null; // sat/vB recommended
  feeRates: {
    fastest: number;
    halfHour: number;
    hour: number;
    economy: number;
    minimum: number;
  } | null;
  btcPrice: number | null; // USD price
  loading: boolean;
}

interface MarketplaceContextValue extends MarketplaceState {
  refreshFeeRates: () => Promise<void>;
}

const MarketplaceContext = createContext<MarketplaceContextValue>({
  blockHeight: null,
  feeRate: null,
  feeRates: null,
  btcPrice: null,
  loading: true,
  refreshFeeRates: async () => {},
});

export function MarketplaceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MarketplaceState>({
    blockHeight: null,
    feeRate: null,
    feeRates: null,
    btcPrice: null,
    loading: true,
  });

  const fetchBlockHeight = useCallback(async () => {
    try {
      const res = await fetch(`${MEMPOOL_API}/blocks/tip/height`);
      if (res.ok) {
        const height = await res.json();
        setState((prev) => ({ ...prev, blockHeight: height }));
      }
    } catch (err) {
      console.error("Failed to fetch block height:", err);
    }
  }, []);

  const fetchFeeRates = useCallback(async () => {
    try {
      const res = await fetch(`${MEMPOOL_API}/v1/fees/recommended`);
      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          feeRates: {
            fastest: data.fastestFee,
            halfHour: data.halfHourFee,
            hour: data.hourFee,
            economy: data.economyFee,
            minimum: data.minimumFee,
          },
          feeRate: data.halfHourFee, // Default to half-hour target
        }));
      }
    } catch (err) {
      console.error("Failed to fetch fee rates:", err);
    }
  }, []);

  const fetchBtcPrice = useCallback(async () => {
    try {
      const res = await fetch(`${MEMPOOL_API}/v1/prices`);
      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({ ...prev, btcPrice: data.USD }));
      }
    } catch (err) {
      console.error("Failed to fetch BTC price:", err);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    Promise.all([fetchBlockHeight(), fetchFeeRates(), fetchBtcPrice()]).finally(
      () => {
        setState((prev) => ({ ...prev, loading: false }));
      }
    );
  }, [fetchBlockHeight, fetchFeeRates, fetchBtcPrice]);

  // Refresh block height every 60s
  useEffect(() => {
    const interval = setInterval(fetchBlockHeight, 60000);
    return () => clearInterval(interval);
  }, [fetchBlockHeight]);

  // Refresh fee rates every 30s
  useEffect(() => {
    const interval = setInterval(fetchFeeRates, 30000);
    return () => clearInterval(interval);
  }, [fetchFeeRates]);

  // Refresh BTC price every 5 min
  useEffect(() => {
    const interval = setInterval(fetchBtcPrice, 300000);
    return () => clearInterval(interval);
  }, [fetchBtcPrice]);

  return (
    <MarketplaceContext.Provider
      value={{
        ...state,
        refreshFeeRates: fetchFeeRates,
      }}
    >
      {children}
    </MarketplaceContext.Provider>
  );
}

export function useMarketplaceContext() {
  return useContext(MarketplaceContext);
}

export default MarketplaceContext;
