import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "@bitcoinerlab/secp256k1";
import {
  INSCRIPTION_OUTPUT_VALUE,
  DUST_LIMIT,
} from "@/utils/constants";
import config from "../../../marketplace.config";
import { calculateMarketplaceFee, estimatePurchaseFees, calculateBuyerTotal } from "./fee-calculator";
import { getClassifiedUtxos, selectUtxos, getOutputScript } from "./utxo";
import { validatePurchasePsbt, validateInscriptionTransfer } from "./validate";
import { isTaprootAddress } from "@/utils/address";

bitcoin.initEccLib(ecc);

/**
 * Complete Purchase PSBT
 *
 * Takes a seller's partial PSBT (listing) and completes it with buyer's inputs
 * and additional outputs (buyer receive, marketplace fee, change).
 *
 * Transaction structure:
 * - Input 0:  Seller's ordinal UTXO (already signed by seller)
 * - Input 1+: Buyer's payment UTXOs
 * - Output 0: Seller's payment (listing price) — committed by seller's signature
 * - Output 1: Buyer receives the ordinal inscription
 * - Output 2: Marketplace fee
 * - Output 3: Buyer's change (if any)
 */

export interface CompletePurchaseParams {
  /** Base64 encoded PSBT from the listing */
  listingPsbtBase64: string;
  /** Buyer's payment address */
  buyerPaymentAddress: string;
  /** Buyer's payment public key (hex) */
  buyerPaymentPublicKey: string;
  /** Buyer's ordinals address (where to receive the inscription) */
  buyerOrdinalsAddress: string;
  /** The listing price in sats (must match seller's expectation) */
  priceSats: number;
  /** Current fee rate in sat/vB */
  feeRateSatVb: number;
  /** The value of the seller's ordinal UTXO */
  ordinalUtxoValue: number;
  /** The offset of the inscription within the seller's UTXO */
  inscriptionOffset: number;
}

export interface CompletePurchaseResult {
  /** Base64 encoded PSBT ready for buyer to sign */
  psbtBase64: string;
  /** Input indices the buyer needs to sign */
  buyerInputIndices: number[];
  /** Fee breakdown */
  fees: {
    priceSats: number;
    marketplaceFeeSats: number;
    minerFeeSats: number;
    totalSats: number;
  };
}

export async function completePurchasePsbt(
  params: CompletePurchaseParams
): Promise<CompletePurchaseResult> {
  const network = bitcoin.networks.bitcoin;

  // Decode the listing PSBT
  const psbt = bitcoin.Psbt.fromBase64(params.listingPsbtBase64, { network });

  // Calculate fees
  const feeEstimate = estimatePurchaseFees(
    params.priceSats,
    params.feeRateSatVb,
    1, // Initial estimate: 1 buyer input
    isTaprootAddress(params.buyerPaymentAddress) ? "taproot" : "segwit"
  );

  const marketplaceFeeSats = calculateMarketplaceFee(params.priceSats);
  const inscriptionOutputValue = INSCRIPTION_OUTPUT_VALUE;

  // Total the buyer needs to provide
  const buyerTotal = calculateBuyerTotal(params.priceSats, feeEstimate, inscriptionOutputValue);

  // Fetch buyer's UTXOs and select enough to cover the purchase
  const { cardinalUtxos } = await getClassifiedUtxos(params.buyerPaymentAddress);
  const { selected: buyerUtxos, totalValue: buyerInputTotal, change } = selectUtxos(
    cardinalUtxos,
    buyerTotal
  );

  // Re-estimate fees with actual number of buyer inputs
  const actualFeeEstimate = estimatePurchaseFees(
    params.priceSats,
    params.feeRateSatVb,
    buyerUtxos.length,
    isTaprootAddress(params.buyerPaymentAddress) ? "taproot" : "segwit"
  );

  // Add buyer's payment inputs
  const buyerInputIndices: number[] = [];
  for (const utxo of buyerUtxos) {
    const outputInfo = await getOutputScript(utxo.txid, utxo.vout);
    const inputIndex = psbt.inputCount;
    buyerInputIndices.push(inputIndex);

    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: Buffer.from(outputInfo.scriptpubkey, "hex"),
        value: BigInt(utxo.satoshi),
      },
    });

    // Add taproot internal key if needed
    if (isTaprootAddress(params.buyerPaymentAddress)) {
      const pubkeyBuffer = Buffer.from(params.buyerPaymentPublicKey, "hex");
      const xOnlyPubkey = pubkeyBuffer.length === 33 ? pubkeyBuffer.subarray(1) : pubkeyBuffer;
      psbt.updateInput(inputIndex, {
        tapInternalKey: xOnlyPubkey,
      });
    }
  }

  // Output 1: Buyer receives the ordinal inscription
  psbt.addOutput({
    address: params.buyerOrdinalsAddress,
    value: BigInt(inscriptionOutputValue),
  });

  // Output 2: Marketplace fee
  if (marketplaceFeeSats >= DUST_LIMIT && config.marketplace.feeAddress) {
    psbt.addOutput({
      address: config.marketplace.feeAddress,
      value: BigInt(marketplaceFeeSats),
    });
  }

  // Output 3: Buyer's change
  const actualMinerFee = actualFeeEstimate.minerFeeSats;
  const totalOutputsBeforeChange =
    params.priceSats + inscriptionOutputValue + marketplaceFeeSats;
  const totalInputs = params.ordinalUtxoValue + buyerInputTotal;
  const changeAmount = totalInputs - totalOutputsBeforeChange - actualMinerFee;

  if (changeAmount >= DUST_LIMIT) {
    psbt.addOutput({
      address: params.buyerPaymentAddress,
      value: BigInt(changeAmount),
    });
  }

  // ========================================
  // CRITICAL: Validate inscription transfer
  // ========================================
  const inputs = [
    {
      value: params.ordinalUtxoValue,
      isOrdinal: true,
      inscriptionOffset: params.inscriptionOffset,
    },
    ...buyerUtxos.map((u) => ({
      value: u.satoshi,
      isOrdinal: false,
      inscriptionOffset: 0,
    })),
  ];

  const outputs: Array<{ value: number; purpose: "seller-payment" | "buyer-ordinal" | "marketplace-fee" | "buyer-change" }> = [
    { value: params.priceSats, purpose: "seller-payment" },
    { value: inscriptionOutputValue, purpose: "buyer-ordinal" },
  ];

  if (marketplaceFeeSats >= DUST_LIMIT && config.marketplace.feeAddress) {
    outputs.push({ value: marketplaceFeeSats, purpose: "marketplace-fee" });
  }

  if (changeAmount >= DUST_LIMIT) {
    outputs.push({ value: changeAmount, purpose: "buyer-change" });
  }

  const transferValidation = validateInscriptionTransfer(
    inputs,
    outputs,
    0, // ordinal is input 0
    1  // buyer receives ordinal at output 1
  );

  if (!transferValidation.valid) {
    throw new Error(
      `INSCRIPTION SAFETY CHECK FAILED: ${transferValidation.error}. ` +
      `Transaction aborted to prevent inscription loss.`
    );
  }

  // Full purchase validation
  const purchaseValidation = validatePurchasePsbt({
    inputs,
    outputs,
    ordinalInputIndex: 0,
    buyerOutputIndex: 1,
    expectedPriceSats: params.priceSats,
    sellerPaymentOutputIndex: 0,
    marketplaceFeeOutputIndex: marketplaceFeeSats >= DUST_LIMIT ? 2 : -1,
    expectedMarketplaceFeeSats: marketplaceFeeSats,
    buyerChangeOutputIndex: outputs.length - 1,
  });

  if (!purchaseValidation.valid) {
    throw new Error(
      `Purchase validation failed:\n${purchaseValidation.errors.join("\n")}`
    );
  }

  return {
    psbtBase64: psbt.toBase64(),
    buyerInputIndices,
    fees: {
      priceSats: params.priceSats,
      marketplaceFeeSats,
      minerFeeSats: actualMinerFee,
      totalSats: params.priceSats + marketplaceFeeSats + actualMinerFee + inscriptionOutputValue,
    },
  };
}
