import {
  VBYTES_P2TR_INPUT,
  VBYTES_P2WPKH_INPUT,
  VBYTES_P2SH_P2WPKH_INPUT,
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
  numSegwitOutputs: number,
  numP2shInputs: number = 0
): number {
  const inputBytes =
    numTaprootInputs * VBYTES_P2TR_INPUT +
    numSegwitInputs * VBYTES_P2WPKH_INPUT +
    numP2shInputs * VBYTES_P2SH_P2WPKH_INPUT;

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
 * Dummy input purchase transaction (OpenOrdex pattern):
 * - Input 0: Buyer's dummy cardinal UTXO (padding for FIFO)
 * - Input 1: Seller's ordinal UTXO (Taproot, signed by seller)
 * - Input 2+: Buyer's payment UTXOs (Taproot or Segwit)
 * - Output 0: Buyer's inscription receive (dummy + ordinal value)
 * - Output 1: Seller's payment (listing price)
 * - Output 2: Marketplace fee
 * - Output 3: Buyer's change
 *
 * numBuyerPaymentInputs does NOT include the dummy — it is counted separately.
 */
export function estimatePurchaseFees(
  priceSats: number,
  feeRateSatVb: number,
  numBuyerPaymentInputs: number = 1,
  buyerInputType: "taproot" | "segwit" | "p2sh-p2wpkh" = "taproot"
): FeeEstimate {
  // +1 for seller's ordinal input (taproot), +1 for buyer's dummy input
  const numTaprootInputs = 2 + (buyerInputType === "taproot" ? numBuyerPaymentInputs : 0);
  const numSegwitInputs = buyerInputType === "segwit" ? numBuyerPaymentInputs : 0;
  const numP2shInputs = buyerInputType === "p2sh-p2wpkh" ? numBuyerPaymentInputs : 0;

  // 4 outputs: buyer inscription, seller payment, marketplace fee, buyer change
  const numTaprootOutputs = 4; // Assume all taproot outputs for estimate
  const numSegwitOutputs = 0;

  const estimatedVbytes = estimateTransactionVsize(
    numTaprootInputs,
    numSegwitInputs,
    numTaprootOutputs,
    numSegwitOutputs,
    numP2shInputs
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
 * Calculate total sats the buyer's PAYMENT UTXOs must cover.
 *
 * With the dummy input pattern:
 *   Inputs:  dummy_value + ordinal_value + payment_total
 *   Outputs: (dummy_value + ordinal_value) [buyer inscription] + price [seller] + fee + change
 *
 * The dummy and ordinal values cancel out (they flow into the buyer's own
 * inscription output), so payment UTXOs only need to cover:
 *   price + marketplace_fee + miner_fee
 */
export function calculateBuyerTotal(
  priceSats: number,
  feeEstimate: FeeEstimate
): number {
  return (
    priceSats +
    feeEstimate.marketplaceFeeSats +
    feeEstimate.minerFeeSats
  );
}
