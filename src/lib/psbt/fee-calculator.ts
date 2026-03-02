import {
  VBYTES_P2TR_INPUT,
  VBYTES_P2WPKH_INPUT,
  VBYTES_P2TR_OUTPUT,
  VBYTES_P2WPKH_OUTPUT,
  VBYTES_TX_OVERHEAD,
  MEMPOOL_API,
} from "@/utils/constants";
import config from "../../../marketplace.config";

/**
 * Fee Calculator
 *
 * Calculates miner fees and marketplace fees for ordinals transactions.
 */

export interface FeeEstimate {
  minerFeeSats: number;
  marketplaceFeeSats: number;
  totalFeeSats: number;
  feeRateSatVb: number;
  estimatedVbytes: number;
}

/**
 * Estimate transaction virtual size in vbytes
 */
export function estimateTransactionVsize(
  numTaprootInputs: number,
  numSegwitInputs: number,
  numTaprootOutputs: number,
  numSegwitOutputs: number
): number {
  const inputBytes =
    numTaprootInputs * VBYTES_P2TR_INPUT +
    numSegwitInputs * VBYTES_P2WPKH_INPUT;

  const outputBytes =
    numTaprootOutputs * VBYTES_P2TR_OUTPUT +
    numSegwitOutputs * VBYTES_P2WPKH_OUTPUT;

  return Math.ceil(VBYTES_TX_OVERHEAD + inputBytes + outputBytes);
}

/**
 * Calculate marketplace fee
 */
export function calculateMarketplaceFee(priceSats: number): number {
  return Math.floor(priceSats * (config.marketplace.feePercent / 100));
}

/**
 * Calculate full fee estimate for a standard ordinals purchase
 *
 * Standard purchase transaction:
 * - Input 0: Seller's ordinal UTXO (Taproot)
 * - Input 1+: Buyer's payment UTXOs (Taproot or Segwit)
 * - Output 0: Seller's payment (price)
 * - Output 1: Buyer's ordinal receive
 * - Output 2: Marketplace fee
 * - Output 3: Buyer's change
 */
export function estimatePurchaseFees(
  priceSats: number,
  feeRateSatVb: number,
  numBuyerInputs: number = 1,
  buyerInputType: "taproot" | "segwit" = "taproot"
): FeeEstimate {
  const numTaprootInputs = 1 + (buyerInputType === "taproot" ? numBuyerInputs : 0);
  const numSegwitInputs = buyerInputType === "segwit" ? numBuyerInputs : 0;

  // 4 outputs: seller payment, buyer ordinal, marketplace fee, buyer change
  const numTaprootOutputs = 4; // Assume all taproot outputs for estimate
  const numSegwitOutputs = 0;

  const estimatedVbytes = estimateTransactionVsize(
    numTaprootInputs,
    numSegwitInputs,
    numTaprootOutputs,
    numSegwitOutputs
  );

  const minerFeeSats = Math.ceil(estimatedVbytes * feeRateSatVb);
  const marketplaceFeeSats = calculateMarketplaceFee(priceSats);

  return {
    minerFeeSats,
    marketplaceFeeSats,
    totalFeeSats: minerFeeSats + marketplaceFeeSats,
    feeRateSatVb,
    estimatedVbytes,
  };
}

/**
 * Fetch current recommended fee rate from mempool.space
 */
export async function getCurrentFeeRate(): Promise<{
  fastest: number;
  halfHour: number;
  hour: number;
  economy: number;
  minimum: number;
}> {
  const res = await fetch(`${MEMPOOL_API}/v1/fees/recommended`);
  if (!res.ok) {
    throw new Error("Failed to fetch fee rates");
  }
  const data = await res.json();
  return {
    fastest: data.fastestFee,
    halfHour: data.halfHourFee,
    hour: data.hourFee,
    economy: data.economyFee,
    minimum: data.minimumFee,
  };
}

/**
 * Calculate total buyer must provide for a purchase
 */
export function calculateBuyerTotal(
  priceSats: number,
  feeEstimate: FeeEstimate,
  inscriptionOutputValue: number = 10000
): number {
  return (
    priceSats +
    feeEstimate.marketplaceFeeSats +
    feeEstimate.minerFeeSats +
    inscriptionOutputValue // Sats for the inscription output sent to buyer
  );
}
