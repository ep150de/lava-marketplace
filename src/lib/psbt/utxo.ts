import indexer from "@/lib/ordinals/indexer";
import type { AddressUtxo } from "@/lib/ordinals/indexer";
import { DUST_LIMIT, DUMMY_UTXO_VALUE } from "@/utils/constants";
import { isTaprootAddress, isP2shAddress } from "@/utils/address";
import * as bitcoin from "bitcoinjs-lib";

/**
 * UTXO Management
 *
 * Handles UTXO fetching, classification (ordinal vs cardinal),
 * and coin selection for marketplace transactions.
 */

export interface ClassifiedUtxo extends AddressUtxo {
  isOrdinal: boolean;
  inscriptionIds: string[];
}

/**
 * Fetch and classify UTXOs for an address
 * Separates ordinal UTXOs (containing inscriptions) from cardinal UTXOs (payment)
 */
export async function getClassifiedUtxos(
  address: string
): Promise<{
  ordinalUtxos: ClassifiedUtxo[];
  cardinalUtxos: ClassifiedUtxo[];
  allUtxos: ClassifiedUtxo[];
}> {
  // Fetch all UTXOs
  const utxos = await indexer.getAddressUtxos(address);

  // Fetch inscription UTXOs to identify which contain inscriptions
  let inscriptionOutputs: Set<string>;
  try {
    const inscriptionUtxos = await indexer.getInscriptionUtxos(address, 0, 500);
    inscriptionOutputs = new Set(
      inscriptionUtxos.list.map((u) => `${u.txid}:${u.vout}`)
    );
  } catch {
    // If we can't fetch inscription UTXOs, treat all as potentially ordinal
    // This is safer — better to over-classify than under-classify
    inscriptionOutputs = new Set();
  }

  const classified = utxos.map((utxo) => {
    const key = `${utxo.txid}:${utxo.vout}`;
    const isOrdinal = inscriptionOutputs.has(key);
    return {
      ...utxo,
      isOrdinal,
      inscriptionIds: utxo.inscriptions || [],
    };
  });

  return {
    ordinalUtxos: classified.filter((u) => u.isOrdinal),
    cardinalUtxos: classified.filter((u) => !u.isOrdinal),
    allUtxos: classified,
  };
}

/**
 * Simple coin selection — selects UTXOs to cover a target amount
 * Uses a greedy algorithm: largest first to minimize inputs
 *
 * IMPORTANT: Only selects from cardinal (non-inscription) UTXOs
 *
 * @param excludeOutpoints - Set of "txid:vout" strings to exclude (e.g., the dummy UTXO)
 */
export function selectUtxos(
  cardinalUtxos: ClassifiedUtxo[],
  targetSats: number,
  excludeOutpoints?: Set<string>
): { selected: ClassifiedUtxo[]; totalValue: number; change: number } {
  // Sort by value descending (largest first)
  const sorted = [...cardinalUtxos].sort((a, b) => b.satoshi - a.satoshi);

  const selected: ClassifiedUtxo[] = [];
  let totalValue = 0;

  for (const utxo of sorted) {
    if (totalValue >= targetSats) break;

    // Skip excluded outpoints (e.g., dummy UTXO already selected)
    if (excludeOutpoints?.has(`${utxo.txid}:${utxo.vout}`)) continue;

    // Skip dust UTXOs — not worth the fee to spend
    if (utxo.satoshi < DUST_LIMIT) continue;

    // Double-check: never select ordinal UTXOs
    if (utxo.isOrdinal) continue;

    selected.push(utxo);
    totalValue += utxo.satoshi;
  }

  if (totalValue < targetSats) {
    throw new Error(
      `Insufficient funds: have ${totalValue} sats, need ${targetSats} sats`
    );
  }

  return {
    selected,
    totalValue,
    change: totalValue - targetSats,
  };
}

/**
 * Select the smallest cardinal UTXO suitable as a dummy input.
 *
 * The dummy input occupies Input 0 in the purchase PSBT so that its sats
 * pad the inscription into Output 0 (buyer's inscription output) via FIFO.
 *
 * Preference: smallest UTXO ≤ DUMMY_UTXO_VALUE (1000 sats).
 * Fallback: any smallest cardinal UTXO ≥ DUST_LIMIT.
 */
export function selectDummyUtxo(
  cardinalUtxos: ClassifiedUtxo[]
): ClassifiedUtxo {
  // Filter to spendable cardinals
  const spendable = cardinalUtxos
    .filter((u) => !u.isOrdinal && u.satoshi >= DUST_LIMIT)
    .sort((a, b) => a.satoshi - b.satoshi); // smallest first

  if (spendable.length === 0) {
    throw new Error(
      "No suitable cardinal UTXO available for dummy input. " +
      "You need at least one non-inscription UTXO with ≥ 546 sats."
    );
  }

  // Prefer a small UTXO ≤ DUMMY_UTXO_VALUE to minimize waste
  const preferred = spendable.find((u) => u.satoshi <= DUMMY_UTXO_VALUE);
  return preferred ?? spendable[0];
}

/**
 * Verify a specific UTXO is still unspent
 */
export async function verifyUtxoUnspent(
  txid: string,
  vout: number
): Promise<boolean> {
  return indexer.isUtxoUnspent(txid, vout);
}

/**
 * Get the scriptPubKey for an output
 */
export async function getOutputScript(
  txid: string,
  vout: number
): Promise<{ value: number; scriptpubkey: string; scriptpubkey_address: string }> {
  const tx = await indexer.getTransaction(txid);
  if (vout >= tx.vout.length) {
    throw new Error(`Output index ${vout} out of range for tx ${txid}`);
  }
  return tx.vout[vout];
}

// =========================================================
// Payment input type detection & PSBT input construction
// =========================================================

/**
 * Classify a payment address into its input type for PSBT construction.
 * - "taproot":      P2TR (bc1p...) — needs tapInternalKey
 * - "p2sh-p2wpkh":  Nested segwit (3...) — needs redeemScript
 * - "segwit":       Native segwit P2WPKH (bc1q...) — witnessUtxo only
 */
export type PaymentInputType = "taproot" | "p2sh-p2wpkh" | "segwit";

export function getPaymentInputType(address: string): PaymentInputType {
  if (isTaprootAddress(address)) return "taproot";
  if (isP2shAddress(address)) return "p2sh-p2wpkh";
  return "segwit";
}

/**
 * Derive the P2WPKH redeemScript for a P2SH-P2WPKH address.
 *
 * The redeemScript is the inner P2WPKH program:
 *   OP_0 <20-byte-HASH160(compressed_pubkey)>
 *
 * This tells bitcoinjs-lib that the P2SH wraps a P2WPKH script,
 * enabling correct signature hash computation.
 */
export function getP2shP2wpkhRedeemScript(publicKeyHex: string): Buffer {
  const pubkeyBuf = Buffer.from(publicKeyHex, "hex");
  const p2wpkh = bitcoin.payments.p2wpkh({
    pubkey: pubkeyBuf,
    network: bitcoin.networks.bitcoin,
  });
  if (!p2wpkh.output) {
    throw new Error("Failed to derive P2WPKH output script from public key");
  }
  return Buffer.from(p2wpkh.output);
}

/**
 * Convert a public key to x-only (32-byte) format for taproot.
 * Strips the 0x02/0x03 prefix byte from a 33-byte compressed key.
 */
function toXOnly(publicKeyHex: string): Buffer {
  const buf = Buffer.from(publicKeyHex, "hex");
  return buf.length === 33 ? buf.subarray(1) : buf;
}

/**
 * Add a payment input to a PSBT with the correct metadata for the address type.
 *
 * Handles the three address types:
 * - Taproot (bc1p): adds tapInternalKey (x-only pubkey)
 * - P2SH-P2WPKH (3): adds redeemScript (inner P2WPKH program)
 * - Native segwit (bc1q): witnessUtxo only (no extra fields needed)
 *
 * @param psbt       The PSBT to add the input to
 * @param txid       UTXO transaction ID
 * @param vout       UTXO output index
 * @param scriptPubKeyHex  The output's scriptPubKey (hex)
 * @param valueSats  The output value in sats
 * @param publicKeyHex  The owner's public key (hex, compressed)
 * @param inputType  The classified input type
 * @param extraFields  Additional PSBT input fields (e.g., sequence, sighashType)
 * @returns The index of the newly added input
 */
export function addPaymentInput(
  psbt: bitcoin.Psbt,
  txid: string,
  vout: number,
  scriptPubKeyHex: string,
  valueSats: number,
  publicKeyHex: string,
  inputType: PaymentInputType,
  extraFields?: { sequence?: number; sighashType?: number }
): number {
  const idx = psbt.inputCount;

  const inputData: Parameters<typeof psbt.addInput>[0] = {
    hash: txid,
    index: vout,
    witnessUtxo: {
      script: Buffer.from(scriptPubKeyHex, "hex"),
      value: BigInt(valueSats),
    },
    ...extraFields,
  };

  psbt.addInput(inputData);

  switch (inputType) {
    case "taproot":
      psbt.updateInput(idx, { tapInternalKey: toXOnly(publicKeyHex) });
      break;
    case "p2sh-p2wpkh":
      psbt.updateInput(idx, {
        redeemScript: getP2shP2wpkhRedeemScript(publicKeyHex),
      });
      break;
    case "segwit":
      // No extra fields needed — witnessUtxo is sufficient
      break;
  }

  return idx;
}
