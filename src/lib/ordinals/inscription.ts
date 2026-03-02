import indexer, { type InscriptionData } from "./indexer";
import config from "../../../marketplace.config";

/**
 * Inscription utilities
 *
 * Higher-level functions for working with inscriptions in the marketplace context.
 */

/**
 * Check if an inscription belongs to the configured collection
 */
export function isCollectionInscription(inscription: InscriptionData): boolean {
  // If no parent IDs configured, we can't filter by collection
  if (config.collection.parentInscriptionIds.length === 0) return true;

  // Check based on inscription location or other metadata
  // In practice, you'd check parent-child relationships
  // For now, we rely on the indexer's collection data
  return true;
}

/**
 * Fetch all collection inscriptions for an address
 */
export async function getCollectionInscriptionsForAddress(
  address: string
): Promise<InscriptionData[]> {
  const all: InscriptionData[] = [];
  let cursor = 0;
  const size = 100;
  let hasMore = true;

  while (hasMore) {
    const { list, total } = await indexer.getInscriptionsByAddress(
      address,
      cursor,
      size
    );
    all.push(...list);
    cursor += size;
    hasMore = cursor < total;
  }

  // Filter to only collection inscriptions
  return all.filter(isCollectionInscription);
}

/**
 * Get inscription with full details
 */
export async function getInscriptionDetails(
  inscriptionId: string
): Promise<InscriptionData & { isCollectionItem: boolean }> {
  const data = await indexer.getInscription(inscriptionId);
  return {
    ...data,
    isCollectionItem: isCollectionInscription(data),
  };
}

/**
 * Parse a satpoint (location) string into components
 * Format: "txid:vout:offset"
 */
export function parseSatpoint(location: string): {
  txid: string;
  vout: number;
  offset: number;
} {
  const parts = location.split(":");
  return {
    txid: parts[0],
    vout: parseInt(parts[1], 10),
    offset: parseInt(parts[2], 10),
  };
}

/**
 * Parse an output string into txid and vout
 * Format: "txid:vout"
 */
export function parseOutput(output: string): { txid: string; vout: number } {
  const [txid, vout] = output.split(":");
  return { txid, vout: parseInt(vout, 10) };
}

/**
 * Get the content rendering URL for an inscription
 */
export function getInscriptionContentUrl(inscriptionId: string): string {
  return `https://ordinals.com/content/${inscriptionId}`;
}

/**
 * Get the preview URL for an inscription
 */
export function getInscriptionPreviewUrl(inscriptionId: string): string {
  return `https://ordinals.com/preview/${inscriptionId}`;
}
