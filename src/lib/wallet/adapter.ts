import type { WalletAdapter, WalletType } from "./types";
import { XverseAdapter } from "./xverse";
import { UnisatAdapter } from "./unisat";
import config from "../../../marketplace.config";

/**
 * Unified wallet adapter
 *
 * Provides a single interface that normalizes Xverse and Unisat wallet APIs.
 * The consumer doesn't need to know which wallet is connected — all operations
 * go through the same interface.
 */

const adapters: Record<WalletType, WalletAdapter> = {
  xverse: new XverseAdapter(),
  unisat: new UnisatAdapter(),
};

/**
 * Get all available wallet adapters (only those that are installed)
 */
export function getAvailableWallets(): WalletAdapter[] {
  const available: WalletAdapter[] = [];

  if (config.wallets.xverse && adapters.xverse.isAvailable()) {
    available.push(adapters.xverse);
  }
  if (config.wallets.unisat && adapters.unisat.isAvailable()) {
    available.push(adapters.unisat);
  }

  return available;
}

/**
 * Get all enabled wallets (regardless of whether they're installed)
 */
export function getEnabledWallets(): { type: WalletType; installed: boolean }[] {
  const wallets: { type: WalletType; installed: boolean }[] = [];

  if (config.wallets.xverse) {
    wallets.push({ type: "xverse", installed: adapters.xverse.isAvailable() });
  }
  if (config.wallets.unisat) {
    wallets.push({ type: "unisat", installed: adapters.unisat.isAvailable() });
  }

  return wallets;
}

/**
 * Get a specific wallet adapter
 */
export function getWalletAdapter(type: WalletType): WalletAdapter {
  return adapters[type];
}

/**
 * Wallet display information
 */
export const WALLET_INFO: Record<
  WalletType,
  { name: string; icon: string; url: string; description: string }
> = {
  xverse: {
    name: "Xverse",
    icon: "X",
    url: "https://www.xverse.app/download",
    description: "Taproot-native Bitcoin wallet with separate payment & ordinals addresses",
  },
  unisat: {
    name: "UniSat",
    icon: "U",
    url: "https://unisat.io/download",
    description: "Popular Bitcoin wallet with built-in ordinals support",
  },
};

export { XverseAdapter } from "./xverse";
export { UnisatAdapter } from "./unisat";
export type { WalletAdapter, WalletType, WalletAddress, WalletState } from "./types";
