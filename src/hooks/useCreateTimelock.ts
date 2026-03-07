"use client";

import { useState, useCallback } from "react";
import { useWallet } from "./useWallet";
import { createTimelockPsbt, type TimelockMode } from "@/lib/psbt";
import {
  deriveNostrKeypair,
  getNostrKeyDerivationMessage,
  publishTimelock,
} from "@/lib/nostr";
import type { TimelockEncryptedContent } from "@/lib/nostr/timelock-schema";
import { saveTimelock } from "@/lib/timelock/storage";
import { parseSatpoint } from "@/lib/ordinals";
import type { InscriptionData } from "@/lib/ordinals";
import { MEMPOOL_API } from "@/utils/constants";

export interface CreateTimelockState {
  step:
    | "idle"
    | "building-psbt"
    | "signing-psbt"
    | "broadcasting"
    | "signing-nostr"
    | "publishing"
    | "complete"
    | "error";
  error?: string;
  txid?: string;
  timelockAddress?: string;
}

/**
 * Hook for creating a new timelock (lock flow).
 *
 * Full flow:
 * 1. Build the CLTV timelock script + PSBT
 * 2. Sign the PSBT with the wallet
 * 3. Broadcast the signed transaction
 * 4. Sign Nostr key derivation message
 * 5. Publish encrypted timelock metadata to Nostr + localStorage
 */
export function useCreateTimelock() {
  const {
    adapter,
    paymentAddress,
    paymentPublicKey,
    ordinalsAddress,
    ordinalsPublicKey,
  } = useWallet();
  const [state, setState] = useState<CreateTimelockState>({ step: "idle" });

  const createTimelock = useCallback(
    async (params: {
      mode: TimelockMode;
      locktime: number;
      feeRateSatVb: number;
      // Inscription mode
      inscription?: InscriptionData;
      // Sats mode
      lockAmountSats?: number;
      // Optional label
      label?: string;
    }) => {
      if (!adapter || !paymentAddress || !paymentPublicKey || !ordinalsAddress || !ordinalsPublicKey) {
        setState({ step: "error", error: "Wallet not connected" });
        return;
      }

      try {
        // Step 1: Build PSBT
        setState({ step: "building-psbt" });

        let inscriptionUtxoTxid: string | undefined;
        let inscriptionUtxoVout: number | undefined;
        let inscriptionUtxoValue: number | undefined;
        let inscriptionOffset: number | undefined;

        if (params.mode === "inscription" && params.inscription) {
          const satpoint = parseSatpoint(params.inscription.location);
          inscriptionUtxoTxid = satpoint.txid;
          inscriptionUtxoVout = satpoint.vout;
          inscriptionUtxoValue = params.inscription.outputValue;
          inscriptionOffset = satpoint.offset;
        }

        const result = await createTimelockPsbt({
          mode: params.mode,
          locktime: params.locktime,
          ordinalsAddress,
          ordinalsPublicKey,
          paymentAddress,
          paymentPublicKey,
          inscriptionUtxoTxid,
          inscriptionUtxoVout,
          inscriptionUtxoValue,
          inscriptionOffset,
          lockAmountSats: params.lockAmountSats,
          feeRateSatVb: params.feeRateSatVb,
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
          autoFinalize: true,
        });

        // Step 3: Broadcast
        setState({ step: "broadcasting" });
        const txid = await adapter.broadcast(signedPsbt);

        // Step 4: Derive Nostr keypair
        setState({ step: "signing-nostr" });
        const nostrMessage = getNostrKeyDerivationMessage();
        const { signature: nostrSig } = await adapter.signMessage({
          address: ordinalsAddress,
          message: nostrMessage,
        });
        const { privateKey: nostrPrivateKey } = deriveNostrKeypair(nostrSig);

        // Step 5: Build timelock record and publish
        setState({ step: "publishing" });

        const timelockData: TimelockEncryptedContent = {
          mode: params.mode,
          locktime: params.locktime,
          timelockAddress: result.timelockAddress,
          timelockScriptHex: result.timelockScriptHex,
          controlBlockHex: result.controlBlockHex,
          internalPubkeyHex: result.internalPubkeyHex,
          lockedValueSats: result.timelockOutputValue,
          lockTxid: txid,
          lockVout: 0, // Timelock is always output 0
          ordinalsAddress,
          ordinalsPublicKey,
          paymentAddress,
          paymentPublicKey,
          inscriptionId: params.inscription?.inscriptionId,
          inscriptionNumber: params.inscription?.inscriptionNumber,
          status: "locked",
          createdAt: Math.floor(Date.now() / 1000),
          label: params.label,
        };

        // Save to localStorage first (instant backup)
        saveTimelock(ordinalsAddress, timelockData);

        // Publish to Nostr (encrypted)
        await publishTimelock(timelockData, nostrPrivateKey);

        setState({
          step: "complete",
          txid,
          timelockAddress: result.timelockAddress,
        });
      } catch (err) {
        console.error("Create timelock failed:", err);
        setState({
          step: "error",
          error: err instanceof Error ? err.message : "Failed to create timelock",
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
    createTimelock,
    reset,
  };
}
