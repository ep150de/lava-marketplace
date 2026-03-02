import {
  INSCRIPTION_OUTPUT_VALUE,
  DUST_LIMIT,
} from "@/utils/constants";

/**
 * PSBT Validation
 *
 * Safety checks to ensure inscriptions are not accidentally burned or
 * sent to the wrong address during marketplace transactions.
 */

export interface TransactionInput {
  value: number; // sats
  isOrdinal: boolean;
  inscriptionOffset: number; // offset of inscription within the UTXO
}

export interface TransactionOutput {
  value: number; // sats
  purpose: "seller-payment" | "buyer-ordinal" | "marketplace-fee" | "buyer-change";
}

/**
 * Validate that an inscription will land in the correct output
 * using Bitcoin's first-in-first-out (FIFO) sat ordering.
 *
 * This is the MOST CRITICAL safety check in the entire marketplace.
 */
export function validateInscriptionTransfer(
  inputs: TransactionInput[],
  outputs: TransactionOutput[],
  ordinalInputIndex: number,
  buyerOutputIndex: number
): {
  valid: boolean;
  error?: string;
  inscriptionLandsInOutput: number;
} {
  // 1. Verify the ordinal input is at the expected index
  if (!inputs[ordinalInputIndex]?.isOrdinal) {
    return {
      valid: false,
      error: `Input ${ordinalInputIndex} is not marked as an ordinal input`,
      inscriptionLandsInOutput: -1,
    };
  }

  // 2. Calculate the absolute sat position of the inscription
  let satsBefore = 0;
  for (let i = 0; i < ordinalInputIndex; i++) {
    satsBefore += inputs[i].value;
  }
  const inscriptionAbsolutePos = satsBefore + inputs[ordinalInputIndex].inscriptionOffset;

  // 3. Determine which output receives this sat (FIFO)
  let outputSatCounter = 0;
  for (let j = 0; j < outputs.length; j++) {
    outputSatCounter += outputs[j].value;
    if (inscriptionAbsolutePos < outputSatCounter) {
      // The inscription lands in output j
      if (j !== buyerOutputIndex) {
        return {
          valid: false,
          error: `Inscription would land in output ${j} (${outputs[j].purpose}) instead of buyer output ${buyerOutputIndex}. ` +
            `Inscription at absolute sat position ${inscriptionAbsolutePos}, output ${j} covers sats up to ${outputSatCounter}.`,
          inscriptionLandsInOutput: j,
        };
      }
      return {
        valid: true,
        inscriptionLandsInOutput: j,
      };
    }
  }

  // If we get here, the inscription falls outside all outputs = miner fees
  const totalOutputValue = outputs.reduce((sum, o) => sum + o.value, 0);
  return {
    valid: false,
    error: `CRITICAL: Inscription at sat position ${inscriptionAbsolutePos} would be burned as miner fees! ` +
      `Total output value: ${totalOutputValue} sats.`,
    inscriptionLandsInOutput: -1,
  };
}

/**
 * Validate a listing PSBT before the seller signs
 */
export function validateListingPsbt(params: {
  ordinalUtxoValue: number;
  inscriptionOffset: number;
  listingPriceSats: number;
  sellerAddress: string;
}): { valid: boolean; error?: string } {
  const { ordinalUtxoValue, inscriptionOffset, listingPriceSats, sellerAddress } = params;

  // Check ordinal UTXO has a non-zero value.
  // Note: Many inscriptions live in sub-dust UTXOs (< 546 sats). This is
  // valid on-chain — the dust limit only applies to *new* outputs. The buyer's
  // inscription output uses INSCRIPTION_OUTPUT_VALUE (10,000 sats) so the
  // completed transaction will always be above dust.
  if (ordinalUtxoValue < 1) {
    return {
      valid: false,
      error: `Ordinal UTXO has no value (${ordinalUtxoValue} sats)`,
    };
  }

  // Check listing price is reasonable
  if (listingPriceSats < DUST_LIMIT) {
    return {
      valid: false,
      error: `Listing price (${listingPriceSats}) must be at least ${DUST_LIMIT} sats`,
    };
  }

  // Check seller address is provided
  if (!sellerAddress) {
    return { valid: false, error: "Seller address is required" };
  }

  // Check inscription offset is within UTXO bounds
  if (inscriptionOffset >= ordinalUtxoValue) {
    return {
      valid: false,
      error: `Inscription offset (${inscriptionOffset}) exceeds UTXO value (${ordinalUtxoValue})`,
    };
  }

  return { valid: true };
}

/**
 * Validate a purchase PSBT before the buyer signs
 */
export function validatePurchasePsbt(params: {
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
  ordinalInputIndex: number;
  buyerOutputIndex: number;
  expectedPriceSats: number;
  sellerPaymentOutputIndex: number;
  marketplaceFeeOutputIndex: number;
  expectedMarketplaceFeeSats: number;
  buyerChangeOutputIndex: number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 1. Validate inscription transfer (CRITICAL)
  const transferValidation = validateInscriptionTransfer(
    params.inputs,
    params.outputs,
    params.ordinalInputIndex,
    params.buyerOutputIndex
  );
  if (!transferValidation.valid) {
    errors.push(transferValidation.error!);
  }

  // 2. Check seller gets paid the correct amount
  const sellerOutput = params.outputs[params.sellerPaymentOutputIndex];
  if (sellerOutput && sellerOutput.value < params.expectedPriceSats) {
    errors.push(
      `Seller payment (${sellerOutput.value}) is less than listing price (${params.expectedPriceSats})`
    );
  }

  // 3. Check marketplace fee is correct
  const feeOutput = params.outputs[params.marketplaceFeeOutputIndex];
  if (feeOutput && feeOutput.value < params.expectedMarketplaceFeeSats) {
    errors.push(
      `Marketplace fee (${feeOutput.value}) is less than expected (${params.expectedMarketplaceFeeSats})`
    );
  }

  // 4. Check buyer's ordinal output has enough value
  const buyerOrdOutput = params.outputs[params.buyerOutputIndex];
  if (buyerOrdOutput && buyerOrdOutput.value < DUST_LIMIT) {
    errors.push(
      `Buyer ordinal output (${buyerOrdOutput.value}) is below dust limit (${DUST_LIMIT})`
    );
  }

  // 5. Check no outputs are below dust limit
  for (let i = 0; i < params.outputs.length; i++) {
    if (params.outputs[i].value > 0 && params.outputs[i].value < DUST_LIMIT) {
      errors.push(`Output ${i} (${params.outputs[i].purpose}) value ${params.outputs[i].value} is below dust limit`);
    }
  }

  // 6. Verify total inputs >= total outputs (miner fee must be positive)
  const totalInputs = params.inputs.reduce((sum, i) => sum + i.value, 0);
  const totalOutputs = params.outputs.reduce((sum, o) => sum + o.value, 0);
  if (totalInputs < totalOutputs) {
    errors.push(
      `Total inputs (${totalInputs}) less than total outputs (${totalOutputs}). Transaction would be invalid.`
    );
  }

  // 7. Check miner fee is reasonable (not too high, not too low)
  const minerFee = totalInputs - totalOutputs;
  if (minerFee < 150) {
    errors.push(`Miner fee (${minerFee} sats) is extremely low. Transaction may not confirm.`);
  }
  if (minerFee > 500000) {
    errors.push(`WARNING: Miner fee (${minerFee} sats) seems abnormally high. Please verify.`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
