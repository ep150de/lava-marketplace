"use client";

import { useState, useCallback } from "react";
import { useWallet } from "./useWallet";
import {
  createUnlockTimelockPsbt,
  finalizeTimelockInput,
  extractTxFromPsbt,
} from "@/lib/psbt";
import {
  deriveNostrKeypair,
  getNostrKeyDerivationMessage,
  updateTimelockStatus,
} from "@/lib/nostr";
import type { TimelockRecord } from "@/lib/nostr/timelock-schema";
import { broadcastTxHex } from "@/lib/bitcoin/broadcast";
import { updateTimelockInStorage } from "@/lib/timelock/storage";

export interface UnlockTimelockState {
  step:
    | "idle"
    | "building-psbt"
    | "signing-psbt"
    | "finalizing"
    | "broadcasting"
    | "updating-nostr"
    | "complete"
    | "error";
  error?: string;
  txid?: string;
}

/**
 * Hook for unlocking an expired timelock.
 *
 * Full flow:
 * 1. Verify timelock is expired
 * 2. Build the unlock PSBT (CLTV script-path spend)
 * 3. Sign: timelocked input (useTweakedSigner: false) + payment inputs (useTweakedSigner: true)
 * 4. Custom finalize the timelocked input
 * 5. Broadcast
 * 6. Update status in Nostr + localStorage
 */
export function useUnlockTimelock() {
  const {
    adapter,
    paymentAddress,
    paymentPublicKey,
    ordinalsAddress,
    ordinalsPublicKey,
  } = useWallet();
  const [state, setState] = useState<UnlockTimelockState>({ step: "idle" });

  const unlockTimelock = useCallback(
    async (
      timelock: TimelockRecord,
      currentBlockHeight: number,
      feeRateSatVb: number
    ) => {
      if (!adapter || !paymentAddress || !paymentPublicKey || !ordinalsAddress || !ordinalsPublicKey) {
        setState({ step: "error", error: "Wallet not connected" });
        return;
      }

      try {
        // Step 1: Build unlock PSBT
        setState({ step: "building-psbt" });

        // Destination: ordinals address for inscriptions, payment address for sats
        const destinationAddress =
          timelock.mode === "inscription" ? ordinalsAddress : paymentAddress;

        const result = await createUnlockTimelockPsbt({
          locktime: timelock.locktime,
          currentBlockHeight,
          timelockUtxoTxid: timelock.lockTxid,
          timelockUtxoVout: timelock.lockVout,
          timelockUtxoValue: timelock.lockedValueSats,
          timelockScriptHex: timelock.timelockScriptHex,
          controlBlockHex: timelock.controlBlockHex,
          internalPubkeyHex: timelock.internalPubkeyHex,
          ordinalsAddress,
          ordinalsPublicKey,
          paymentAddress,
          paymentPublicKey,
          destinationAddress,
          feeRateSatVb,
        });

        // Step 2: Sign PSBT
        setState({ step: "signing-psbt" });
        const { signedPsbt } = await adapter.signPsbt({
          psbt: result.psbtBase64,
          signInputs: result.signInputs.map((si) => ({
            address: si.address,
            index: si.index,
            useTweakedSigner: si.useTweakedSigner,
          })),
          broadcast: false,
          autoFinalize: false, // We need custom finalization for the timelocked input
        });

        // Step 3: Custom finalize the timelocked input
        setState({ step: "finalizing" });
        const finalizedPsbt = finalizeTimelockInput(
          signedPsbt,
          result.timelockInputIndex
        );

        // Step 4: Extract raw tx and broadcast via mempool.space
        setState({ step: "broadcasting" });
        const txHex = extractTxFromPsbt(finalizedPsbt);
        const txid = await broadcastTxHex(txHex);

        // Step 5: Update status in Nostr + localStorage
        setState({ step: "updating-nostr" });

        // Update localStorage immediately
        updateTimelockInStorage(ordinalsAddress, timelock.lockTxid, timelock.lockVout, {
          status: "unlocked",
          unlockTxid: txid,
        });

        // Update Nostr (NIP-33 replacement)
        try {
          const nostrMessage = getNostrKeyDerivationMessage();
          const { signature: nostrSig } = await adapter.signMessage({
            address: paymentAddress,
            message: nostrMessage,
          });
          const { privateKey: nostrPrivateKey } = deriveNostrKeypair(nostrSig);

          await updateTimelockStatus(
            {
              ...timelock,
              status: "unlocked",
              unlockTxid: txid,
            },
            nostrPrivateKey
          );
        } catch (nostrErr) {
          console.warn("[useUnlockTimelock] Nostr update failed (localStorage is up to date):", nostrErr);
        }

        setState({ step: "complete", txid });
      } catch (err) {
        console.error("Unlock timelock failed:", err);
        setState({
          step: "error",
          error: err instanceof Error ? err.message : "Failed to unlock timelock",
        });
      }
    },
    [adapter, paymentAddress, paymentPublicKey, ordinalsAddress, ordinalsPublicKey]
  );

  const reset = useCallback(() => {
    setState({ step: "idle" });
  }, []);

  return {
    ...state,
    unlockTimelock,
    reset,
  };
}
