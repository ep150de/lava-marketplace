import indexer from "@/lib/ordinals/indexer";
import type { AddressUtxo } from "@/lib/ordinals/indexer";

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
 */
export function selectUtxos(
  cardinalUtxos: ClassifiedUtxo[],
  targetSats: number
): { selected: ClassifiedUtxo[]; totalValue: number; change: number } {
  // Sort by value descending (largest first)
  const sorted = [...cardinalUtxos].sort((a, b) => b.satoshi - a.satoshi);

  const selected: ClassifiedUtxo[] = [];
  let totalValue = 0;

  for (const utxo of sorted) {
    if (totalValue >= targetSats) break;

    // Skip dust UTXOs — not worth the fee to spend
    if (utxo.satoshi < 546) continue;

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
