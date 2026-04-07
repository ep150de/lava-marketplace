import indexer, { type InscriptionData } from "./indexer";
import config from "../../../marketplace.config";

/**
 * Inscription utilities
 *
 * Higher-level functions for working with inscriptions in the marketplace context.
 */

/** Cache for collection membership checks to avoid redundant API calls */
const collectionCache = new Map<string, boolean>();

// ============================================================
// GENEALOGY TYPES
// ============================================================

/** Lightweight inscription summary used in genealogy trees */
export interface InscriptionSummary {
  id: string;
  number: number;
  output: string;
  timestamp: number;
  contentType?: string;
}

/** Full inscription info from ordinals.com /r/inscription endpoint */
export interface InscriptionInfo {
  id: string;
  number: number;
  content_type: string;
  content_length: number;
  height: number;
  timestamp: number;
  output: string;
  satpoint: string;
  address?: string;
  fee: number;
  charms: string[];
}

/** Response from the ordinals.com /r/children and /r/parents endpoints */
interface PageResponse {
  ids: string[];
  more: boolean;
  page_index?: number;
  page?: number;
}

/** Full genealogy tree for an inscription */
export interface InscriptionGenealogy {
  parents: InscriptionSummary[];
  children: InscriptionSummary[];
  hasMoreParents: boolean;
  hasMoreChildren: boolean;
}

async function fetchAllInscriptionsForAddress(address: string): Promise<InscriptionData[]> {
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

  return all;
}

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

// ============================================================
// GENEALOGY FUNCTIONS
// ============================================================

/**
 * Fetch child inscription IDs for a given inscription from ordinals.com.
 * Uses the recursive endpoint /r/children/{inscriptionId}/{page}.
 */
async function fetchChildrenIds(inscriptionId: string): Promise<{ ids: string[]; more: boolean }> {
  const allIds: string[] = [];
  let page = 0;
  let more = true;

  while (more) {
    const url = `https://ordinals.com/r/children/${inscriptionId}/${page}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!res.ok) {
      throw new Error(`Failed to fetch children for ${inscriptionId}: ${res.status}`);
    }

    const data: PageResponse = await res.json();
    allIds.push(...data.ids);
    more = data.more;
    page++;
  }

  return { ids: allIds, more };
}

/**
 * Fetch paginated child inscription IDs for a given inscription.
 * Used for deep genealogy when user expands a child to see its children.
 */
export async function fetchInscriptionChildrenPage(
  inscriptionId: string,
  page: number
): Promise<{ ids: string[]; more: boolean }> {
  const url = `https://ordinals.com/r/children/${inscriptionId}/${page}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

  if (!res.ok) {
    return { ids: [], more: false };
  }

  const data: PageResponse = await res.json();
  return { ids: data.ids, more: data.more };
}

/**
 * Fetch full inscription info from ordinals.com /r/inscription endpoint.
 */
export async function fetchInscriptionInfo(inscriptionId: string): Promise<InscriptionInfo | null> {
  try {
    const url = `https://ordinals.com/r/inscription/${inscriptionId}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!res.ok) return null;

    const data: InscriptionInfo = await res.json();
    return data;
  } catch {
    return null;
  }
}

/**
 * Build lightweight inscription summaries from IDs.
 * Fetches inscription info in parallel batches for the first batch.
 */
async function buildInscriptionSummaries(ids: string[]): Promise<InscriptionSummary[]> {
  if (ids.length === 0) return [];

  const summaries: InscriptionSummary[] = [];

  const batchSize = 20;
  for (let i = 0; i < Math.min(ids.length, 100); i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const infos = await Promise.all(batch.map((id) => fetchInscriptionInfo(id)));

    for (const info of infos) {
      if (info) {
        summaries.push({
          id: info.id,
          number: info.number,
          output: info.output,
          timestamp: info.timestamp,
          contentType: info.content_type,
        });
      } else {
        summaries.push({
          id: batch[infos.indexOf(info)],
          number: 0,
          output: "",
          timestamp: 0,
        });
      }
    }
  }

  return summaries;
}

/**
 * Fetch the full genealogy tree for an inscription.
 * Retrieves first page of parents and first page of children (up to 100 each).
 */
export async function getInscriptionGenealogy(
  inscriptionId: string
): Promise<InscriptionGenealogy> {
  const [parentResult, childResult] = await Promise.all([
    (async () => {
      try {
        const ids = await fetchParentIds(inscriptionId);
        const summaries = await buildInscriptionSummaries(ids);
        return { summaries, hasMore: ids.length >= 100 };
      } catch {
        return { summaries: [], hasMore: false };
      }
    })(),
    (async () => {
      try {
        const result = await fetchChildrenIds(inscriptionId);
        const summaries = await buildInscriptionSummaries(result.ids);
        return { summaries, hasMore: result.more };
      } catch {
        return { summaries: [], hasMore: false };
      }
    })(),
  ]);

  return {
    parents: parentResult.summaries,
    children: childResult.summaries,
    hasMoreParents: parentResult.hasMore,
    hasMoreChildren: childResult.hasMore,
  };
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
  const all = await fetchAllInscriptionsForAddress(address);

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
 * Fetch all inscriptions for an address without collection filtering.
 */
export async function getInscriptionsForAddress(
  address: string
): Promise<InscriptionData[]> {
  return fetchAllInscriptionsForAddress(address);
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
