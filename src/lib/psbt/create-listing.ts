import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "@bitcoinerlab/secp256k1";
import {
  SIGHASH_SINGLE_ANYONECANPAY,
  INSCRIPTION_OUTPUT_VALUE,
} from "@/utils/constants";
import { getOutputScript } from "./utxo";
import { validateListingPsbt } from "./validate";
import { isTaprootAddress } from "@/utils/address";

// Initialize bitcoinjs-lib with ECC library
bitcoin.initEccLib(ecc);

/**
 * Create Listing PSBT
 *
 * Creates a Partially Signed Bitcoin Transaction for listing an ordinal for sale.
 * The seller signs with SIGHASH_SINGLE | SIGHASH_ANYONECANPAY, which means:
 * - Their signature only commits to their input and the corresponding output (seller payment)
 * - Anyone can add additional inputs (buyer's payment) and outputs (buyer receive, fees)
 *
 * This is the core trustless trading mechanism.
 */

export interface CreateListingParams {
  /** Seller's ordinals address (where the inscription currently lives) */
  sellerOrdinalsAddress: string;
  /** Seller's ordinals public key (hex) */
  sellerOrdinalsPublicKey: string;
  /** Seller's payment address (where they want to receive payment) */
  sellerPaymentAddress: string;
  /** The inscription ID being listed */
  inscriptionId: string;
  /** The UTXO containing the inscription: txid */
  utxoTxid: string;
  /** The UTXO containing the inscription: output index */
  utxoVout: number;
  /** The value of the UTXO in sats */
  utxoValue: number;
  /** The offset of the inscription within the UTXO */
  inscriptionOffset: number;
  /** Listing price in sats */
  priceSats: number;
}

export interface CreateListingResult {
  /** Base64 encoded PSBT ready for seller to sign */
  psbtBase64: string;
  /** Input index the seller needs to sign */
  sellerInputIndex: number;
  /** The sighash type to use */
  sighashType: number;
}

export async function createListingPsbt(
  params: CreateListingParams
): Promise<CreateListingResult> {
  // Validate parameters
  const validation = validateListingPsbt({
    ordinalUtxoValue: params.utxoValue,
    inscriptionOffset: params.inscriptionOffset,
    listingPriceSats: params.priceSats,
    sellerAddress: params.sellerPaymentAddress,
  });

  if (!validation.valid) {
    throw new Error(`Listing validation failed: ${validation.error}`);
  }

  const network = bitcoin.networks.bitcoin;
  const psbt = new bitcoin.Psbt({ network });

  // Fetch the output script for the ordinal UTXO
  const outputInfo = await getOutputScript(params.utxoTxid, params.utxoVout);

  // Add the ordinal UTXO as input
  psbt.addInput({
    hash: params.utxoTxid,
    index: params.utxoVout,
    witnessUtxo: {
      script: Buffer.from(outputInfo.scriptpubkey, "hex"),
      value: BigInt(params.utxoValue),
    },
    sighashType: SIGHASH_SINGLE_ANYONECANPAY,
  });

  // If taproot, add the internal key
  if (isTaprootAddress(params.sellerOrdinalsAddress)) {
    // For taproot key-path spend, the internal key is the x-only public key
    const pubkeyBuffer = Buffer.from(params.sellerOrdinalsPublicKey, "hex");
    const xOnlyPubkey = pubkeyBuffer.length === 33 ? pubkeyBuffer.subarray(1) : pubkeyBuffer;
    psbt.updateInput(0, {
      tapInternalKey: xOnlyPubkey,
    });
  }

  // Add seller's payment output at index 0
  // (Must be at same index as input for SIGHASH_SINGLE to work)
  psbt.addOutput({
    address: params.sellerPaymentAddress,
    value: BigInt(params.priceSats),
  });

  return {
    psbtBase64: psbt.toBase64(),
    sellerInputIndex: 0,
    sighashType: SIGHASH_SINGLE_ANYONECANPAY,
  };
}
