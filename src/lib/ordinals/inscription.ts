import indexer, { type InscriptionData } from "./indexer";
import config from "../../../marketplace.config";

/**
 * Inscription utilities
 *
 * Higher-level functions for working with inscriptions in the marketplace context.
 */

/** Cache for collection membership checks to avoid redundant API calls */
const collectionCache = new Map<string, boolean>();

/**
 * Fetch parent inscription IDs for a given inscription from ordinals.com.
 * Uses the recursive endpoint /r/parents/{inscriptionId} which returns
 * paginated parent IDs.
 */
async function fetchParentIds(inscriptionId: string): Promise<string[]> {
  const allIds: string[] = [];
  let page = 0;
  let more = true;

  while (more) {
    const url = `https://ordinals.com/r/parents/${inscriptionId}/${page}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!res.ok) {
      throw new Error(`Failed to fetch parents for ${inscriptionId}: ${res.status}`);
    }

    const data: { ids: string[]; more: boolean; page_index: number } = await res.json();
    allIds.push(...data.ids);
    more = data.more;
    page++;
  }

  return allIds;
}

/**
 * Check if an inscription belongs to the configured collection by verifying
 * that at least one of its parent inscriptions is in the configured parent IDs.
 *
 * Results are cached in memory to avoid redundant API calls.
 * Returns false on error (safe default — reject unverified inscriptions).
 */
export async function isCollectionInscription(inscription: InscriptionData): Promise<boolean> {
  // If no parent IDs configured, we can't filter by collection
  if (config.collection.parentInscriptionIds.length === 0) return true;

  // Check cache first
  const cached = collectionCache.get(inscription.inscriptionId);
  if (cached !== undefined) return cached;

  try {
    const parentIds = await fetchParentIds(inscription.inscriptionId);
    const configParents = new Set(config.collection.parentInscriptionIds);
    const isMatch = parentIds.some((pid) => configParents.has(pid));

    collectionCache.set(inscription.inscriptionId, isMatch);
    return isMatch;
  } catch (err) {
    console.error(`Failed to verify collection membership for ${inscription.inscriptionId}:`, err);
    // On error, return false (safe default — don't allow unverified inscriptions)
    return false;
  }
}

/**
 * Clear the collection membership cache (e.g., on config change)
 */
export function clearCollectionCache(): void {
  collectionCache.clear();
}

/**
 * Fetch all collection inscriptions for an address.
 * Fetches all inscriptions, then validates each against the collection
 * parent IDs using ordinals.com provenance data.
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

  // Validate collection membership in parallel
  const checks = await Promise.all(
    all.map(async (inscription) => ({
      inscription,
      isCollection: await isCollectionInscription(inscription),
    }))
  );

  return checks
    .filter((c) => c.isCollection)
    .map((c) => c.inscription);
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
    isCollectionItem: await isCollectionInscription(data),
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
