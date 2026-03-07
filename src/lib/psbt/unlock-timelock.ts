import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "@bitcoinerlab/secp256k1";
import {
  DUST_LIMIT,
  TIMELOCK_SEQUENCE,
  LEAF_VERSION_TAPSCRIPT,
} from "@/utils/constants";
import { toXOnlyPubkey, createTimelockAddress, isLocktimeExpired } from "./timelock-script";
import { getClassifiedUtxos, selectUtxos, getOutputScript } from "./utxo";
import { estimateTransactionVsize } from "./fee-calculator";
import { isTaprootAddress } from "@/utils/address";

// Initialize bitcoinjs-lib with ECC library
bitcoin.initEccLib(ecc);

/**
 * Unlock Timelock PSBT — Spend a timelocked UTXO after expiry.
 *
 * Unlock Transaction Structure:
 * - psbt.setLocktime(locktime) — CRITICAL: must match the CLTV value
 * - Input 0:  Timelocked UTXO (script-path spend) — sequence: 0xFFFFFFFE
 * - Input 1+: Payment UTXOs for miner fees — sequence: 0xFFFFFFFE
 * - Output 0: Owner's destination address (ordinals or payment)
 * - Output 1: Change to payment address (if any)
 *
 * The timelocked input uses script-path spending:
 * - tapLeafScript with the CLTV script and control block
 * - useTweakedSigner: false (Schnorr signature without tweak)
 * - Custom finalization to build the correct witness stack
 */

export interface UnlockTimelockParams {
  /** The locktime from the original timelock script */
  locktime: number;
  /** Current block height (for validation) */
  currentBlockHeight: number;

  // --- Timelocked UTXO ---
  /** Timelocked UTXO txid */
  timelockUtxoTxid: string;
  /** Timelocked UTXO vout */
  timelockUtxoVout: number;
  /** Timelocked UTXO value in sats */
  timelockUtxoValue: number;
  /** The timelock script (hex) from the lock result */
  timelockScriptHex: string;
  /** The control block (hex) from the lock result */
  controlBlockHex: string;
  /** The internal pubkey (hex) from the lock result */
  internalPubkeyHex: string;

  // --- Owner ---
  /** Owner's ordinals address (destination for inscription unlocks) */
  ordinalsAddress: string;
  /** Owner's ordinals public key (hex) */
  ordinalsPublicKey: string;
  /** Owner's payment address (for fees + sats unlock destination) */
  paymentAddress: string;
  /** Owner's payment public key (hex) */
  paymentPublicKey: string;

  // --- Options ---
  /** Whether to send to ordinals address (inscription) or payment address (sats) */
  destinationAddress: string;
  /** Fee rate in sat/vB */
  feeRateSatVb: number;
}

export interface UnlockTimelockResult {
  /** Base64 encoded PSBT ready for signing */
  psbtBase64: string;
  /** Input indices and signing config */
  signInputs: {
    address: string;
    index: number;
    useTweakedSigner: boolean;
  }[];
  /** The timelocked input index (needs custom finalization after signing) */
  timelockInputIndex: number;
  /** Estimated miner fee */
  minerFeeSats: number;
  /** Amount being unlocked (sent to destination) */
  unlockAmountSats: number;
}

export async function createUnlockTimelockPsbt(
  params: UnlockTimelockParams
): Promise<UnlockTimelockResult> {
  // Validate that the timelock has expired
  if (!isLocktimeExpired(params.locktime, params.currentBlockHeight)) {
    throw new Error(
      "Timelock has not expired yet. Cannot unlock."
    );
  }

  const network = bitcoin.networks.bitcoin;
  const psbt = new bitcoin.Psbt({ network });

  // CRITICAL: Set the transaction nLockTime to match the CLTV value
  psbt.setLocktime(params.locktime);

  const timelockScript = Buffer.from(params.timelockScriptHex, "hex");
  const controlBlock = Buffer.from(params.controlBlockHex, "hex");

  // Reconstruct witnessUtxo for the timelocked UTXO
  // We need to derive the output script from the timelock address
  const ownerXOnlyPubkey = toXOnlyPubkey(params.ordinalsPublicKey);
  const { outputScript: timelockOutputScript } = createTimelockAddress(
    params.locktime,
    ownerXOnlyPubkey
  );

  const signInputs: UnlockTimelockResult["signInputs"] = [];

  // --- Input 0: Timelocked UTXO (script-path spend) ---
  psbt.addInput({
    hash: params.timelockUtxoTxid,
    index: params.timelockUtxoVout,
    witnessUtxo: {
      script: timelockOutputScript,
      value: BigInt(params.timelockUtxoValue),
    },
    tapLeafScript: [
      {
        leafVersion: LEAF_VERSION_TAPSCRIPT,
        script: timelockScript,
        controlBlock: controlBlock,
      },
    ],
    sequence: TIMELOCK_SEQUENCE, // 0xFFFFFFFE — enables CLTV
  });

  signInputs.push({
    address: params.ordinalsAddress,
    index: 0,
    useTweakedSigner: false, // Script-path Schnorr signing (no tweak)
  });

  // Estimate fees: 1 timelocked input (larger witness) + N payment inputs
  // Tapscript input is bigger than standard P2TR due to script + control block in witness
  // Rough estimate: ~100 vbytes for tapscript input (script ~40 bytes + control block ~33 bytes + sig ~64 bytes + overhead)
  const VBYTES_TAPSCRIPT_INPUT = 100;
  const buyerInputType = isTaprootAddress(params.paymentAddress)
    ? ("taproot" as const)
    : ("segwit" as const);

  // Initial estimate with 1 payment input
  const initialVsize =
    10.5 + // overhead
    VBYTES_TAPSCRIPT_INPUT + // timelocked input
    (buyerInputType === "taproot" ? 57.5 : 68) + // 1 payment input
    43 * 2; // 2 outputs (destination + change)
  const initialMinerFee = Math.ceil(initialVsize * params.feeRateSatVb);

  // How much the destination output gets (timelocked value minus fees from payment UTXOs)
  // We want to send the full timelocked amount to the destination
  // Payment UTXOs cover the miner fee
  const unlockAmountSats = params.timelockUtxoValue;

  // Select payment UTXOs to cover miner fees
  const { cardinalUtxos } = await getClassifiedUtxos(params.paymentAddress);
  const { selected: paymentUtxos, totalValue: paymentTotal } = selectUtxos(
    cardinalUtxos,
    initialMinerFee
  );

  // Re-estimate with actual payment input count
  const actualVsize =
    10.5 +
    VBYTES_TAPSCRIPT_INPUT +
    paymentUtxos.length * (buyerInputType === "taproot" ? 57.5 : 68) +
    43 * 2;
  const actualMinerFee = Math.ceil(actualVsize * params.feeRateSatVb);

  // Add payment inputs
  for (const utxo of paymentUtxos) {
    const outputInfo = await getOutputScript(utxo.txid, utxo.vout);
    const idx = psbt.inputCount;
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: Buffer.from(outputInfo.scriptpubkey, "hex"),
        value: BigInt(utxo.satoshi),
      },
      sequence: TIMELOCK_SEQUENCE, // All inputs need matching sequence for CLTV
    });
    if (buyerInputType === "taproot") {
      const payXOnly = toXOnlyPubkey(params.paymentPublicKey);
      psbt.updateInput(idx, { tapInternalKey: payXOnly });
    }
    signInputs.push({
      address: params.paymentAddress,
      index: idx,
      useTweakedSigner: true, // Standard key-path for payment inputs
    });
  }

  // Output 0: Destination (full timelocked amount)
  psbt.addOutput({
    address: params.destinationAddress,
    value: BigInt(unlockAmountSats),
  });

  // Output 1: Change from payment UTXOs
  const changeAmount = paymentTotal - actualMinerFee;
  if (changeAmount >= DUST_LIMIT) {
    psbt.addOutput({
      address: params.paymentAddress,
      value: BigInt(changeAmount),
    });
  }

  return {
    psbtBase64: psbt.toBase64(),
    signInputs,
    timelockInputIndex: 0,
    minerFeeSats: actualMinerFee,
    unlockAmountSats,
  };
}

/**
 * Finalize the timelocked input after signing.
 *
 * The witness stack for a tapscript CLTV spend is:
 * [signature, script, controlBlock]
 *
 * This must be called on the signed PSBT before broadcasting.
 */
export function finalizeTimelockInput(
  psbtBase64: string,
  timelockInputIndex: number
): string {
  const network = bitcoin.networks.bitcoin;
  const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network });

  // Custom finalizer for the tapscript input
  psbt.finalizeTaprootInput(timelockInputIndex, undefined, (inputIndex, input) => {
    // Get the tapscript signature
    const tapScriptSig = input.tapScriptSig;
    if (!tapScriptSig || tapScriptSig.length === 0) {
      throw new Error(
        `No tapscript signature found for input ${inputIndex}. ` +
        `Make sure the input was signed with useTweakedSigner: false.`
      );
    }

    const signature = tapScriptSig[0].signature;

    // Get the tap leaf script data
    const tapLeafScript = input.tapLeafScript;
    if (!tapLeafScript || tapLeafScript.length === 0) {
      throw new Error(`No tapLeafScript found for input ${inputIndex}`);
    }

    const { script, controlBlock } = tapLeafScript[0];

    // Build witness: [signature, script, controlBlock]
    return {
      finalScriptWitness: witnessStackToScriptWitness([
        Buffer.from(signature),
        Buffer.from(script),
        Buffer.from(controlBlock),
      ]),
    };
  });

  // Finalize remaining inputs normally (payment inputs)
  for (let i = 0; i < psbt.inputCount; i++) {
    if (i !== timelockInputIndex) {
      try {
        psbt.finalizeInput(i);
      } catch {
        // May already be finalized
      }
    }
  }

  return psbt.toBase64();
}

/**
 * Convert a witness stack to a script witness buffer.
 * This is the serialization format used in the transaction witness field.
 */
function witnessStackToScriptWitness(witness: Buffer[]): Buffer {
  let totalLength = 1; // varint for number of items

  for (const item of witness) {
    totalLength += varintSize(item.length) + item.length;
  }

  const result = Buffer.allocUnsafe(totalLength);
  let offset = 0;

  // Number of witness items
  offset = writeVarint(result, witness.length, offset);

  for (const item of witness) {
    offset = writeVarint(result, item.length, offset);
    item.copy(result, offset);
    offset += item.length;
  }

  return result;
}

function varintSize(n: number): number {
  if (n < 0xfd) return 1;
  if (n <= 0xffff) return 3;
  if (n <= 0xffffffff) return 5;
  return 9;
}

function writeVarint(buffer: Buffer, value: number, offset: number): number {
  if (value < 0xfd) {
    buffer.writeUInt8(value, offset);
    return offset + 1;
  } else if (value <= 0xffff) {
    buffer.writeUInt8(0xfd, offset);
    buffer.writeUInt16LE(value, offset + 1);
    return offset + 3;
  } else if (value <= 0xffffffff) {
    buffer.writeUInt8(0xfe, offset);
    buffer.writeUInt32LE(value, offset + 1);
    return offset + 5;
  } else {
    buffer.writeUInt8(0xff, offset);
    buffer.writeUInt32LE(value & 0xffffffff, offset + 1);
    buffer.writeUInt32LE(Math.floor(value / 0x100000000), offset + 5);
    return offset + 9;
  }
}

/**
 * Extract the raw transaction hex from a fully signed and finalized PSBT.
 */
export function extractTxFromPsbt(psbtBase64: string): string {
  const network = bitcoin.networks.bitcoin;
  const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network });
  return psbt.extractTransaction().toHex();
}
