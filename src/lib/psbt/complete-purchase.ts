import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "@bitcoinerlab/secp256k1";
import {
  DUST_LIMIT,
  SIGHASH_SINGLE_ANYONECANPAY,
} from "@/utils/constants";
import config from "../../../marketplace.config";
import { calculateMarketplaceFee, estimatePurchaseFees, calculateBuyerTotal } from "./fee-calculator";
import { getClassifiedUtxos, selectUtxos, selectDummyUtxo, getOutputScript, getPaymentInputType, addPaymentInput } from "./utxo";
import { validatePurchasePsbt, validateInscriptionTransfer } from "./validate";
import { isTaprootAddress } from "@/utils/address";

bitcoin.initEccLib(ecc);

/**
 * Complete Purchase PSBT — Dummy Input Reconstruction Pattern
 *
 * Instead of appending to the seller's PSBT, we reconstruct a NEW PSBT
 * with the correct input/output ordering for FIFO inscription routing.
 *
 * Transaction structure:
 * - Input 0:  Buyer's dummy cardinal UTXO (padding for FIFO)
 * - Input 1:  Seller's ordinal UTXO (signature copied from listing PSBT)
 * - Input 2+: Buyer's payment UTXOs
 * - Output 0: Buyer receives inscription (value = dummy + ordinal UTXO value)
 * - Output 1: Seller's payment (listing price) — identical to listing PSBT output
 * - Output 2: Marketplace fee
 * - Output 3: Buyer's change (if any)
 *
 * Why this works:
 * - FIFO sat tracking: Input 0 (dummy) sats fill Output 0 first,
 *   then Input 1 (ordinal) sats continue into Output 0. The inscription
 *   at offset X within Input 1 lands at absolute position (dummy_value + X),
 *   which is inside Output 0 (value = dummy_value + ordinal_utxo_value). ✓
 * - Seller's SIGHASH_SINGLE|ANYONECANPAY signature remains valid because:
 *   (1) ANYONECANPAY excludes input_index from the sighash preimage
 *   (2) SIGHASH_SINGLE commits to the output at the same index as the input
 *   (3) Output 1 in the new tx = Output 0 from the listing PSBT (identical script/value)
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

  // =========================================================
  // 1. Decode listing PSBT and extract seller's data
  // =========================================================
  const listingPsbt = bitcoin.Psbt.fromBase64(params.listingPsbtBase64, { network });

  // Extract seller's input via public API (txInputs returns PsbtTxInput[])
  const sellerTxInput = listingPsbt.txInputs[0];
  // Extract seller's PSBT-level input data (witnessUtxo, tapInternalKey, signatures)
  const sellerPsbtInput = listingPsbt.data.inputs[0];
  // Extract seller's output via public API (txOutputs returns PsbtTxOutput[])
  const sellerTxOutput = listingPsbt.txOutputs[0];

  // =========================================================
  // 2. Fetch buyer's UTXOs and select dummy + payment
  // =========================================================
  const { cardinalUtxos } = await getClassifiedUtxos(params.buyerPaymentAddress);

  // Select dummy UTXO (smallest cardinal)
  const dummyUtxo = selectDummyUtxo(cardinalUtxos);
  const dummyOutpoint = `${dummyUtxo.txid}:${dummyUtxo.vout}`;

  // Initial fee estimate (1 payment input estimate)
  const buyerInputType = getPaymentInputType(params.buyerPaymentAddress);
  const initialFeeEstimate = estimatePurchaseFees(
    params.priceSats,
    params.feeRateSatVb,
    1,
    buyerInputType
  );

  const marketplaceFeeSats = calculateMarketplaceFee(params.priceSats);

  // Calculate how much buyer's payment UTXOs must cover
  const buyerPaymentTarget = calculateBuyerTotal(params.priceSats, initialFeeEstimate);

  // Select payment UTXOs, excluding the dummy
  const { selected: paymentUtxos, totalValue: paymentTotal } = selectUtxos(
    cardinalUtxos,
    buyerPaymentTarget,
    new Set([dummyOutpoint])
  );

  // Re-estimate with actual payment input count
  const actualFeeEstimate = estimatePurchaseFees(
    params.priceSats,
    params.feeRateSatVb,
    paymentUtxos.length,
    buyerInputType
  );
  const actualMinerFee = actualFeeEstimate.minerFeeSats;

  // =========================================================
  // 3. Construct new PSBT (WITHOUT seller signatures first)
  // =========================================================
  const psbt = new bitcoin.Psbt({ network });

  // --- Input 0: Buyer's dummy UTXO ---
  const dummyOutputInfo = await getOutputScript(dummyUtxo.txid, dummyUtxo.vout);
  addPaymentInput(
    psbt,
    dummyUtxo.txid,
    dummyUtxo.vout,
    dummyOutputInfo.scriptpubkey,
    dummyUtxo.satoshi,
    params.buyerPaymentPublicKey,
    buyerInputType
  );

  // --- Input 1: Seller's ordinal UTXO (no signatures yet) ---
  // Reconstruct the input from listing PSBT data
  // sellerTxInput.hash is a Uint8Array in internal byte order (reversed txid)
  const sellerTxid = Buffer.from(sellerTxInput.hash).reverse().toString("hex");
  psbt.addInput({
    hash: sellerTxid,
    index: sellerTxInput.index,
    witnessUtxo: sellerPsbtInput.witnessUtxo!,
    sighashType: SIGHASH_SINGLE_ANYONECANPAY,
  });
  // Copy tapInternalKey if present (taproot seller)
  if (sellerPsbtInput.tapInternalKey) {
    psbt.updateInput(1, { tapInternalKey: sellerPsbtInput.tapInternalKey });
  }

  // --- Inputs 2+: Buyer's payment UTXOs ---
  const buyerInputIndices: number[] = [0]; // dummy is buyer input 0
  for (const utxo of paymentUtxos) {
    const outputInfo = await getOutputScript(utxo.txid, utxo.vout);
    const inputIndex = addPaymentInput(
      psbt,
      utxo.txid,
      utxo.vout,
      outputInfo.scriptpubkey,
      utxo.satoshi,
      params.buyerPaymentPublicKey,
      buyerInputType
    );
    buyerInputIndices.push(inputIndex);
  }

  // --- Output 0: Buyer receives the inscription ---
  // Value = dummy sats + ordinal UTXO sats (absorbs all sats from inputs 0 + 1)
  const buyerInscriptionValue = dummyUtxo.satoshi + params.ordinalUtxoValue;
  psbt.addOutput({
    address: params.buyerOrdinalsAddress,
    value: BigInt(buyerInscriptionValue),
  });

  // --- Output 1: Seller's payment (exact same script + value from listing) ---
  psbt.addOutput({
    script: sellerTxOutput.script,
    value: sellerTxOutput.value, // Already BigInt from bitcoinjs-lib v7
  });

  // --- Output 2: Marketplace fee ---
  if (marketplaceFeeSats >= DUST_LIMIT && config.marketplace.feeAddress) {
    psbt.addOutput({
      address: config.marketplace.feeAddress,
      value: BigInt(marketplaceFeeSats),
    });
  }

  // --- Output 3: Buyer's change ---
  // Total inputs from buyer (dummy + payment UTXOs)
  const buyerInputTotal = dummyUtxo.satoshi + paymentTotal;
  // Total outputs paid by buyer's sats:
  //   buyer inscription value = dummy + ordinal (dummy portion from buyer, ordinal from seller)
  //   So buyer's net contribution to inscription output = dummy value
  //   Plus: seller payment + marketplace fee from buyer's payment UTXOs
  const buyerCost = dummyUtxo.satoshi + params.priceSats + marketplaceFeeSats + actualMinerFee;
  const changeAmount = buyerInputTotal - buyerCost;

  if (changeAmount >= DUST_LIMIT) {
    psbt.addOutput({
      address: params.buyerPaymentAddress,
      value: BigInt(changeAmount),
    });
  }

  // =========================================================
  // 4. Copy seller's signature data onto input 1
  // =========================================================
  // This must happen AFTER all inputs/outputs are added to avoid
  // "Can not modify transaction, signatures exist" error.
  const sellerInput = psbt.data.inputs[1];

  // Taproot signatures
  if (sellerPsbtInput.tapKeySig) {
    sellerInput.tapKeySig = sellerPsbtInput.tapKeySig;
  }
  if (sellerPsbtInput.tapScriptSig && sellerPsbtInput.tapScriptSig.length > 0) {
    sellerInput.tapScriptSig = sellerPsbtInput.tapScriptSig;
  }

  // Segwit signatures
  if (sellerPsbtInput.partialSig && sellerPsbtInput.partialSig.length > 0) {
    sellerInput.partialSig = sellerPsbtInput.partialSig;
  }

  // Finalized signatures (if the listing PSBT was already finalized)
  if (sellerPsbtInput.finalScriptWitness) {
    sellerInput.finalScriptWitness = sellerPsbtInput.finalScriptWitness;
  }
  if (sellerPsbtInput.finalScriptSig) {
    sellerInput.finalScriptSig = sellerPsbtInput.finalScriptSig;
  }

  // =========================================================
  // 5. CRITICAL: Validate inscription transfer (FIFO check)
  // =========================================================
  const inputs = [
    {
      value: dummyUtxo.satoshi,
      isOrdinal: false,
      inscriptionOffset: 0,
    },
    {
      value: params.ordinalUtxoValue,
      isOrdinal: true,
      inscriptionOffset: params.inscriptionOffset,
    },
    ...paymentUtxos.map((u) => ({
      value: u.satoshi,
      isOrdinal: false,
      inscriptionOffset: 0,
    })),
  ];

  const outputs: Array<{ value: number; purpose: "buyer-ordinal" | "seller-payment" | "marketplace-fee" | "buyer-change" }> = [
    { value: buyerInscriptionValue, purpose: "buyer-ordinal" },
    { value: params.priceSats, purpose: "seller-payment" },
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
    1, // ordinal is input 1 (seller's)
    0  // buyer receives ordinal at output 0
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
    ordinalInputIndex: 1,
    buyerOutputIndex: 0,
    expectedPriceSats: params.priceSats,
    sellerPaymentOutputIndex: 1,
    marketplaceFeeOutputIndex: marketplaceFeeSats >= DUST_LIMIT ? 2 : -1,
    expectedMarketplaceFeeSats: marketplaceFeeSats,
    buyerChangeOutputIndex: changeAmount >= DUST_LIMIT ? outputs.length - 1 : -1,
  });

  if (!purchaseValidation.valid) {
    throw new Error(
      `Purchase validation failed:\n${purchaseValidation.errors.join("\n")}`
    );
  }

  return {
    psbtBase64: psbt.toBase64(),
    buyerInputIndices, // [0, 2, 3, ...] — dummy + payment inputs (NOT input 1 = seller)
    fees: {
      priceSats: params.priceSats,
      marketplaceFeeSats,
      minerFeeSats: actualMinerFee,
      totalSats: params.priceSats + marketplaceFeeSats + actualMinerFee,
    },
  };
}
