"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { WalletState, WalletType, WalletAddress } from "@/lib/wallet/types";
import { INITIAL_WALLET_STATE } from "@/lib/wallet/types";
import { getWalletAdapter, getAvailableWallets } from "@/lib/wallet/adapter";
import type { WalletAdapter } from "@/lib/wallet/adapter";

interface WalletContextValue extends WalletState {
  /** Currently active adapter */
  adapter: WalletAdapter | null;

  /** Connect to a specific wallet */
  connect: (type: WalletType) => Promise<void>;

  /** Disconnect current wallet */
  disconnect: () => Promise<void>;

  /** Whether a connection attempt is in progress */
  connecting: boolean;

  /** Connection error message */
  error: string | null;

  /** Clear error */
  clearError: () => void;

  /** Available wallets (installed) */
  availableWallets: WalletAdapter[];
}

const WalletContext = createContext<WalletContextValue>({
  ...INITIAL_WALLET_STATE,
  adapter: null,
  connect: async () => {},
  disconnect: async () => {},
  connecting: false,
  error: null,
  clearError: () => {},
  availableWallets: [],
});

const WALLET_STORAGE_KEY = "lava-marketplace-wallet";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>(INITIAL_WALLET_STATE);
  const [adapter, setAdapter] = useState<WalletAdapter | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableWallets, setAvailableWallets] = useState<WalletAdapter[]>([]);

  // Detect available wallets on mount
  useEffect(() => {
    // Small delay to let wallet extensions inject their APIs
    const timer = setTimeout(() => {
      setAvailableWallets(getAvailableWallets());
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Auto-reconnect on mount if previously connected
  useEffect(() => {
    const savedType = localStorage.getItem(WALLET_STORAGE_KEY);
    if (savedType) {
      const timer = setTimeout(() => {
        const walletAdapter = getWalletAdapter(savedType as WalletType);
        if (walletAdapter.isAvailable()) {
          connectWallet(savedType as WalletType, true);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processAddresses = useCallback((addresses: WalletAddress[]) => {
    const payment = addresses.find((a) => a.purpose === "payment");
    const ordinals = addresses.find((a) => a.purpose === "ordinals");

    return {
      addresses,
      paymentAddress: payment?.address || null,
      paymentPublicKey: payment?.publicKey || null,
      ordinalsAddress: ordinals?.address || null,
      ordinalsPublicKey: ordinals?.publicKey || null,
    };
  }, []);

  const connectWallet = useCallback(
    async (type: WalletType, silent = false) => {
      if (!silent) setConnecting(true);
      setError(null);

      try {
        const walletAdapter = getWalletAdapter(type);

        if (!walletAdapter.isAvailable()) {
          throw new Error(
            `${type.toUpperCase()} wallet is not installed. Please install it and refresh the page.`
          );
        }

        const addresses = await walletAdapter.connect();
        const processed = processAddresses(addresses);

        setState({
          connected: true,
          type,
          ...processed,
        });

        setAdapter(walletAdapter);
        localStorage.setItem(WALLET_STORAGE_KEY, type);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to connect wallet";
        if (!silent) setError(message);
        console.error(`Wallet connection error (${type}):`, err);
      } finally {
        if (!silent) setConnecting(false);
      }
    },
    [processAddresses]
  );

  const disconnectWallet = useCallback(async () => {
    try {
      if (adapter) {
        await adapter.disconnect();
      }
    } catch (err) {
      console.error("Wallet disconnect error:", err);
    } finally {
      setState(INITIAL_WALLET_STATE);
      setAdapter(null);
      localStorage.removeItem(WALLET_STORAGE_KEY);
    }
  }, [adapter]);

  const clearError = useCallback(() => setError(null), []);

  return (
    <WalletContext.Provider
      value={{
        ...state,
        adapter,
        connect: connectWallet,
        disconnect: disconnectWallet,
        connecting,
        error,
        clearError,
        availableWallets,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWalletContext must be used within a WalletProvider");
  }
  return context;
}

export default WalletContext;
