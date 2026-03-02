"use client";

import { useMarketplaceContext } from "@/context/MarketplaceContext";

/**
 * Hook for current Bitcoin fee rates
 */
export function useFeeRate() {
  const { feeRate, feeRates, refreshFeeRates } = useMarketplaceContext();
  return { feeRate, feeRates, refreshFeeRates };
}
