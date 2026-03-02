"use client";

import { useState, useCallback } from "react";
import { useWallet } from "./useWallet";
import { useFeeRate } from "./useFeeRate";
import { completePurchasePsbt } from "@/lib/psbt";
import type { ListingWithNostr } from "@/lib/nostr";

export interface PurchaseState {
  step: "idle" | "preparing" | "signing" | "broadcasting" | "complete" | "error";
  error?: string;
  txid?: string;
  fees?: {
    priceSats: number;
    marketplaceFeeSats: number;
    minerFeeSats: number;
    totalSats: number;
  };
}

/**
 * Hook for purchasing a listed ordinal
 */
export function usePurchase() {
  const {
    adapter,
    paymentAddress,
    paymentPublicKey,
    ordinalsAddress,
  } = useWallet();
  const { feeRate } = useFeeRate();
  const [state, setState] = useState<PurchaseState>({ step: "idle" });

  const purchase = useCallback(
    async (listing: ListingWithNostr) => {
      if (!adapter || !paymentAddress || !paymentPublicKey || !ordinalsAddress) {
        setState({ step: "error", error: "Wallet not connected" });
        return;
      }

      if (!feeRate) {
        setState({ step: "error", error: "Fee rate not available. Please try again." });
        return;
      }

      try {
        // Step 1: Prepare the purchase PSBT
        setState({ step: "preparing" });
        const { psbtBase64, buyerInputIndices, fees } =
          await completePurchasePsbt({
            listingPsbtBase64: listing.psbtBase64,
            buyerPaymentAddress: paymentAddress,
            buyerPaymentPublicKey: paymentPublicKey,
            buyerOrdinalsAddress: ordinalsAddress,
            priceSats: listing.priceSats,
            feeRateSatVb: feeRate,
            ordinalUtxoValue: listing.utxoValue,
            inscriptionOffset: listing.inscriptionOffset,
          });

        setState({ step: "signing", fees });

        // Step 2: Buyer signs the PSBT
        const { signedPsbt } = await adapter.signPsbt({
          psbt: psbtBase64,
          signInputs: buyerInputIndices.map((index) => ({
            address: paymentAddress,
            index,
          })),
          broadcast: false,
          autoFinalize: true,
        });

        // Step 3: Broadcast the transaction
        setState({ step: "broadcasting", fees });
        const txid = await adapter.broadcast(signedPsbt);

        setState({ step: "complete", txid, fees });
      } catch (err) {
        console.error("Purchase failed:", err);
        setState({
          step: "error",
          error: err instanceof Error ? err.message : "Purchase failed",
        });
      }
    },
    [adapter, paymentAddress, paymentPublicKey, ordinalsAddress, feeRate]
  );

  const reset = useCallback(() => {
    setState({ step: "idle" });
  }, []);

  return {
    ...state,
    purchase,
    reset,
  };
}
