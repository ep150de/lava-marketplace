"use client";

import { useState, useCallback } from "react";
import { useWallet } from "./useWallet";
import { createListingPsbt } from "@/lib/psbt";
import {
  publishListing,
  deriveNostrKeypair,
  getNostrKeyDerivationMessage,
} from "@/lib/nostr";
import { parseSatpoint, isCollectionInscription } from "@/lib/ordinals";
import type { InscriptionData } from "@/lib/ordinals";
import config from "../../marketplace.config";

export interface CreateListingState {
  step: "idle" | "validating-collection" | "signing-nostr" | "creating-psbt" | "signing-psbt" | "publishing" | "complete" | "error";
  error?: string;
  txid?: string;
  eventId?: string;
}

/**
 * Hook for creating a new listing
 */
export function useCreateListing() {
  const { adapter, paymentAddress, ordinalsAddress, ordinalsPublicKey } = useWallet();
  const [state, setState] = useState<CreateListingState>({ step: "idle" });

  const createListing = useCallback(
    async (inscription: InscriptionData, priceSats: number) => {
      if (!adapter || !paymentAddress || !ordinalsAddress || !ordinalsPublicKey) {
        setState({ step: "error", error: "Wallet not connected" });
        return;
      }

      try {
        // Step 0: Validate collection membership via provenance
        setState({ step: "validating-collection" });
        const isCollection = await isCollectionInscription(inscription);
        if (!isCollection) {
          setState({
            step: "error",
            error: "This inscription is not part of the Lava Lamps collection. Only verified grandchild inscriptions with valid parent provenance can be listed.",
          });
          return;
        }

        // Step 1: Derive Nostr keypair from BTC signature
        setState({ step: "signing-nostr" });
        const nostrMessage = getNostrKeyDerivationMessage();
        const { signature: nostrSig } = await adapter.signMessage({
          address: ordinalsAddress,
          message: nostrMessage,
        });
        const { privateKey: nostrPrivateKey } = deriveNostrKeypair(nostrSig);

        // Step 2: Create listing PSBT
        setState({ step: "creating-psbt" });
        const { txid: utxoTxid, vout: utxoVout, offset: inscriptionOffset } =
          parseSatpoint(inscription.location);

        const { psbtBase64, sellerInputIndex, sighashType } =
          await createListingPsbt({
            sellerOrdinalsAddress: ordinalsAddress,
            sellerOrdinalsPublicKey: ordinalsPublicKey,
            sellerPaymentAddress: paymentAddress,
            inscriptionId: inscription.inscriptionId,
            utxoTxid,
            utxoVout,
            utxoValue: inscription.outputValue,
            inscriptionOffset,
            priceSats,
          });

        // Step 3: Seller signs the PSBT
        setState({ step: "signing-psbt" });
        const { signedPsbt } = await adapter.signPsbt({
          psbt: psbtBase64,
          signInputs: [
            {
              address: ordinalsAddress,
              index: sellerInputIndex,
              sighashTypes: [sighashType],
            },
          ],
          broadcast: false,
          autoFinalize: false,
        });

        // Step 4: Publish listing to Nostr relays
        setState({ step: "publishing" });
        const { eventId } = await publishListing(
          {
            psbtBase64: signedPsbt,
            collectionSlug: config.collection.slug,
            inscriptionId: inscription.inscriptionId,
            priceSats,
            sellerAddress: ordinalsAddress,
            utxo: `${utxoTxid}:${utxoVout}`,
            inscriptionOffset,
            utxoValue: inscription.outputValue,
            listedAt: Math.floor(Date.now() / 1000),
            contentType: inscription.contentType,
          },
          nostrPrivateKey
        );

        setState({ step: "complete", eventId });
      } catch (err) {
        console.error("Create listing failed:", err);
        setState({
          step: "error",
          error: err instanceof Error ? err.message : "Failed to create listing",
        });
      }
    },
    [adapter, paymentAddress, ordinalsAddress, ordinalsPublicKey]
  );

  const reset = useCallback(() => {
    setState({ step: "idle" });
  }, []);

  return {
    ...state,
    createListing,
    reset,
  };
}
