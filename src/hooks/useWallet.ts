"use client";

import { useWalletContext } from "@/context/WalletContext";

/**
 * Hook for wallet operations
 *
 * Provides the full wallet state and all operations
 * (connect, disconnect, sign, etc.)
 */
export function useWallet() {
  const context = useWalletContext();
  return context;
}
