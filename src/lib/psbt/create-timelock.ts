import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "@bitcoinerlab/secp256k1";
import {
  DUST_LIMIT,
  TIMELOCK_MIN_OUTPUT_VALUE,
  TIMELOCK_SEQUENCE,
} from "@/utils/constants";
import { createTimelockAddress, toXOnlyPubkey } from "./timelock-script";
import { getClassifiedUtxos, selectUtxos, getOutputScript, getPaymentInputType, addPaymentInput } from "./utxo";
import { estimateTransactionVsize } from "./fee-calculator";
import { validateInscriptionTransfer } from "./validate";
import { isTaprootAddress } from "@/utils/address";

// Initialize bitcoinjs-lib with ECC library
bitcoin.initEccLib(ecc);

/**
 * Create Timelock PSBT — Lock inscriptions or sats behind a CLTV timelock.
 *
 * Lock Transaction Structure:
 * - Input 0:  Inscription UTXO (ordinals address) — MUST be first for FIFO safety
 * - Input 1+: Payment UTXOs for miner fees
 * - Output 0: Timelock P2TR address (receives the inscription/sats)
 * - Output 1: Change to payment address (if any)
 *
 * For sats-only locks (no inscription):
 * - Input 0+: Payment UTXOs
 * - Output 0: Timelock P2TR address (receives the locked sats)
 * - Output 1: Change to payment address (if any)
 */

export type TimelockMode = "inscription" | "sats";

export interface CreateTimelockParams {
  mode: TimelockMode;
  /** Locktime: block height (< 500M) or Unix timestamp (>= 500M) */
  locktime: number;

  // --- Owner's addresses ---
  /** Owner's ordinals address (source of inscription, also the unlock recipient) */
  ordinalsAddress: string;
  /** Owner's ordinals public key (hex) — used to derive x-only key for the script */
  ordinalsPublicKey: string;
  /** Owner's payment address (source of fee UTXOs + change) */
  paymentAddress: string;
  /** Owner's payment public key (hex) */
  paymentPublicKey: string;

  // --- Inscription mode fields ---
  /** Inscription UTXO txid (required for inscription mode) */
  inscriptionUtxoTxid?: string;
  /** Inscription UTXO vout (required for inscription mode) */
  inscriptionUtxoVout?: number;
  /** Inscription UTXO value in sats (required for inscription mode) */
  inscriptionUtxoValue?: number;
  /** Inscription offset within the UTXO (required for inscription mode) */
  inscriptionOffset?: number;

  // --- Sats mode fields ---
  /** Amount of sats to lock (required for sats mode) */
  lockAmountSats?: number;

  // --- Fee ---
  /** Fee rate in sat/vB */
  feeRateSatVb: number;
}

export interface CreateTimelockResult {
  /** Base64 encoded PSBT ready for signing */
  psbtBase64: string;
  /** Input indices the owner needs to sign (key-path, tweaked) */
  signInputs: {
    address: string;
    index: number;
    useTweakedSigner: boolean;
  }[];
  /** The timelock P2TR address (for storage/display) */
  timelockAddress: string;
  /** The timelock script (hex) — needed for unlocking */
  timelockScriptHex: string;
  /** The control block (hex) — needed for unlocking */
  controlBlockHex: string;
  /** The internal pubkey (hex) — needed for unlocking */
  internalPubkeyHex: string;
  /** The output value sent to the timelock address */
  timelockOutputValue: number;
  /** Estimated miner fee */
  minerFeeSats: number;
}

export async function createTimelockPsbt(
  params: CreateTimelockParams
): Promise<CreateTimelockResult> {
  const network = bitcoin.networks.bitcoin;
  const psbt = new bitcoin.Psbt({ network });

  // Derive owner's x-only pubkey for the CLTV script
  const ownerXOnlyPubkey = toXOnlyPubkey(params.ordinalsPublicKey);

  // Create the timelock address
  const {
    address: timelockAddress,
    script: timelockScript,
    controlBlock,
    internalPubkey,
  } = createTimelockAddress(params.locktime, ownerXOnlyPubkey);

  const isInscriptionMode = params.mode === "inscription";
  const paymentInputType = getPaymentInputType(params.paymentAddress);

  const signInputs: CreateTimelockResult["signInputs"] = [];

  if (isInscriptionMode) {
    // =========================================================
    // INSCRIPTION MODE
    // =========================================================
    if (
      params.inscriptionUtxoTxid === undefined ||
      params.inscriptionUtxoVout === undefined ||
      params.inscriptionUtxoValue === undefined ||
      params.inscriptionOffset === undefined
    ) {
      throw new Error("Inscription UTXO details are required for inscription mode");
    }

    // Input 0: Inscription UTXO (ordinals address)
    const inscOutputInfo = await getOutputScript(
      params.inscriptionUtxoTxid,
      params.inscriptionUtxoVout
    );

    psbt.addInput({
      hash: params.inscriptionUtxoTxid,
      index: params.inscriptionUtxoVout,
      witnessUtxo: {
        script: Buffer.from(inscOutputInfo.scriptpubkey, "hex"),
        value: BigInt(params.inscriptionUtxoValue),
      },
    });

    // Add tapInternalKey for ordinals address if taproot
    if (isTaprootAddress(params.ordinalsAddress)) {
      const ordXOnly = toXOnlyPubkey(params.ordinalsPublicKey);
      psbt.updateInput(0, { tapInternalKey: ordXOnly });
    }

    signInputs.push({
      address: params.ordinalsAddress,
      index: 0,
      useTweakedSigner: true, // Standard key-path spend
    });

    // Estimate fees: 1 ordinal input (taproot) + N payment inputs
    const initialVsize = estimateTransactionVsize(
      1 + (paymentInputType === "taproot" ? 1 : 0),
      paymentInputType === "segwit" ? 1 : 0,
      1, // Timelock output (taproot)
      0,
      paymentInputType === "p2sh-p2wpkh" ? 1 : 0
    );
    const initialMinerFee = Math.ceil(initialVsize * params.feeRateSatVb);

    // Output 0 value: inscription UTXO value (maintain inscription value)
    const timelockOutputValue = Math.max(
      params.inscriptionUtxoValue,
      TIMELOCK_MIN_OUTPUT_VALUE
    );

    // Select payment UTXOs to cover miner fees (+ potential top-up if inscription is sub-dust)
    const topUp = timelockOutputValue > params.inscriptionUtxoValue
      ? timelockOutputValue - params.inscriptionUtxoValue
      : 0;
    const paymentTarget = initialMinerFee + topUp;

    const { cardinalUtxos } = await getClassifiedUtxos(params.paymentAddress);
    const { selected: paymentUtxos, totalValue: paymentTotal } = selectUtxos(
      cardinalUtxos,
      paymentTarget
    );

    // Re-estimate with actual payment input count
    const actualTrInputs = 1 + (paymentInputType === "taproot" ? paymentUtxos.length : 0);
    const actualSwInputs = paymentInputType === "segwit" ? paymentUtxos.length : 0;
    const actualP2shInputs = paymentInputType === "p2sh-p2wpkh" ? paymentUtxos.length : 0;
    // 1 timelock output + 1 change output (taproot)
    const actualVsize = estimateTransactionVsize(actualTrInputs, actualSwInputs, 2, 0, actualP2shInputs);
    const actualMinerFee = Math.ceil(actualVsize * params.feeRateSatVb);

    // Add payment inputs
    for (const utxo of paymentUtxos) {
      const outputInfo = await getOutputScript(utxo.txid, utxo.vout);
      const idx = addPaymentInput(
        psbt,
        utxo.txid,
        utxo.vout,
        outputInfo.scriptpubkey,
        utxo.satoshi,
        params.paymentPublicKey,
        paymentInputType
      );
      signInputs.push({
        address: params.paymentAddress,
        index: idx,
        useTweakedSigner: true,
      });
    }

    // Output 0: Timelock address (receives the inscription)
    psbt.addOutput({
      address: timelockAddress,
      value: BigInt(timelockOutputValue),
    });

    // Output 1: Change
    const totalInputs = params.inscriptionUtxoValue + paymentTotal;
    const changeAmount = totalInputs - timelockOutputValue - actualMinerFee;
    if (changeAmount >= DUST_LIMIT) {
      psbt.addOutput({
        address: params.paymentAddress,
        value: BigInt(changeAmount),
      });
    }

    // FIFO validation: inscription must land in Output 0
    const inputs = [
      { value: params.inscriptionUtxoValue, isOrdinal: true, inscriptionOffset: params.inscriptionOffset },
      ...paymentUtxos.map((u) => ({ value: u.satoshi, isOrdinal: false, inscriptionOffset: 0 })),
    ];
    const outputs: Array<{ value: number; purpose: "buyer-ordinal" | "buyer-change" }> = [
      { value: timelockOutputValue, purpose: "buyer-ordinal" },
    ];
    if (changeAmount >= DUST_LIMIT) {
      outputs.push({ value: changeAmount, purpose: "buyer-change" });
    }
    const fifo = validateInscriptionTransfer(inputs, outputs, 0, 0);
    if (!fifo.valid) {
      throw new Error(`INSCRIPTION SAFETY: ${fifo.error}. Lock aborted.`);
    }

    return {
      psbtBase64: psbt.toBase64(),
      signInputs,
      timelockAddress,
      timelockScriptHex: timelockScript.toString("hex"),
      controlBlockHex: controlBlock.toString("hex"),
      internalPubkeyHex: internalPubkey.toString("hex"),
      timelockOutputValue,
      minerFeeSats: actualMinerFee,
    };
  } else {
    // =========================================================
    // SATS MODE
    // =========================================================
    if (!params.lockAmountSats || params.lockAmountSats < TIMELOCK_MIN_OUTPUT_VALUE) {
      throw new Error(
        `Lock amount must be at least ${TIMELOCK_MIN_OUTPUT_VALUE} sats`
      );
    }

    // Estimate fees: N payment inputs, 2 outputs (timelock + change)
    const initialVsize = estimateTransactionVsize(
      paymentInputType === "taproot" ? 1 : 0,
      paymentInputType === "segwit" ? 1 : 0,
      2, // timelock + change
      0,
      paymentInputType === "p2sh-p2wpkh" ? 1 : 0
    );
    const initialMinerFee = Math.ceil(initialVsize * params.feeRateSatVb);

    const { cardinalUtxos } = await getClassifiedUtxos(params.paymentAddress);
    const { selected: paymentUtxos, totalValue: paymentTotal } = selectUtxos(
      cardinalUtxos,
      params.lockAmountSats + initialMinerFee
    );

    // Re-estimate with actual input count
    const actualTrInputs = paymentInputType === "taproot" ? paymentUtxos.length : 0;
    const actualSwInputs = paymentInputType === "segwit" ? paymentUtxos.length : 0;
    const actualP2shInputs = paymentInputType === "p2sh-p2wpkh" ? paymentUtxos.length : 0;
    const actualVsize = estimateTransactionVsize(actualTrInputs, actualSwInputs, 2, 0, actualP2shInputs);
    const actualMinerFee = Math.ceil(actualVsize * params.feeRateSatVb);

    // Add payment inputs
    for (const utxo of paymentUtxos) {
      const outputInfo = await getOutputScript(utxo.txid, utxo.vout);
      const idx = addPaymentInput(
        psbt,
        utxo.txid,
        utxo.vout,
        outputInfo.scriptpubkey,
        utxo.satoshi,
        params.paymentPublicKey,
        paymentInputType
      );
      signInputs.push({
        address: params.paymentAddress,
        index: idx,
        useTweakedSigner: true,
      });
    }

    // Output 0: Timelock address
    psbt.addOutput({
      address: timelockAddress,
      value: BigInt(params.lockAmountSats),
    });

    // Output 1: Change
    const changeAmount = paymentTotal - params.lockAmountSats - actualMinerFee;
    if (changeAmount >= DUST_LIMIT) {
      psbt.addOutput({
        address: params.paymentAddress,
        value: BigInt(changeAmount),
      });
    }

    return {
      psbtBase64: psbt.toBase64(),
      signInputs,
      timelockAddress,
      timelockScriptHex: timelockScript.toString("hex"),
      controlBlockHex: controlBlock.toString("hex"),
      internalPubkeyHex: internalPubkey.toString("hex"),
      timelockOutputValue: params.lockAmountSats,
      minerFeeSats: actualMinerFee,
    };
  }
}
