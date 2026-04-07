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
  parents: string[];
  children: string[];
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
  parents: string[];
  children: string[];
}

/** Response from the ordinals.com /r/children and /r/parents endpoints */
interface PageResponse {
  ids: string[];
  more: boolean;
  page_index?: number;
  page?: number;
}

interface BatchInscriptionResponse {
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
  parents: string[];
  children: string[];
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
 * Fetch full inscription info from ordinals.com /inscription endpoint.
 */
export async function fetchInscriptionInfo(inscriptionId: string): Promise<InscriptionInfo | null> {
  try {
    const url = `https://ordinals.com/inscription/${inscriptionId}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!res.ok) return null;

    const data: InscriptionInfo = await res.json();
    return data;
  } catch {
    return null;
  }
}

/**
 * Batch fetch inscription summaries using POST /inscriptions endpoint.
 * Accepts an array of inscription IDs and returns full inscription data for all.
 * Uses pagination of 25 per page to handle large numbers of inscriptions.
 */
export async function fetchInscriptionSummariesBatch(ids: string[]): Promise<InscriptionSummary[]> {
  if (ids.length === 0) return [];

  const uniqueIds = [...new Set(ids)];
  const summaries: InscriptionSummary[] = [];
  const batchSize = 25;

  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    const batch = uniqueIds.slice(i, i + batchSize);

    try {
      const res = await fetch("https://ordinals.com/inscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) continue;

      const infos: BatchInscriptionResponse[] = await res.json();

      for (const info of infos) {
        summaries.push({
          id: info.id,
          number: info.number,
          output: info.output,
          timestamp: info.timestamp,
          contentType: info.content_type,
          parents: info.parents || [],
          children: info.children || [],
        });
      }
    } catch {
      // If batch fails, fall back to recursive batch call with smaller batches
      const partial = await fetchInscriptionSummariesBatch(batch);
      summaries.push(...partial);
    }
  }

  return summaries;
}

/**
 * Fetch the full genealogy tree for an inscription using efficient batch endpoints.
 * 1. Call GET /r/inscription/{id} once → get parents[] and children[] IDs directly
 * 2. Call POST /inscriptions with all IDs → get all metadata in ONE batch
 * Times out after 15 seconds to avoid hanging the UI.
 */
export async function getInscriptionGenealogyV2(
  inscriptionId: string
): Promise<InscriptionGenealogy> {
  const fetchGenealogy = async () => {
    const info = await fetchInscriptionInfo(inscriptionId);

    if (!info) {
      return { parents: [], children: [], hasMoreParents: false, hasMoreChildren: false };
    }

    const allIds = [...info.parents, ...info.children];
    const summaries = await fetchInscriptionSummariesBatch(allIds);

    const parentIdsSet = new Set(info.parents);
    const parents = summaries.filter((s) => parentIdsSet.has(s.id));
    const children = summaries.filter((s) => !parentIdsSet.has(s.id));

    return {
      parents,
      children,
      hasMoreParents: false,
      hasMoreChildren: false,
    };
  };

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Genealogy request timed out after 15s")), 15000)
  );

  return Promise.race([fetchGenealogy(), timeoutPromise]);
}

/**
 * Fetch the full genealogy tree for an inscription.
 * Delegates to V2 implementation.
 */
export async function getInscriptionGenealogy(
  inscriptionId: string
): Promise<InscriptionGenealogy> {
  return getInscriptionGenealogyV2(inscriptionId);
}

/**
 * Check if an inscription belongs to the configured collection by verifying
 * that at least one of its parent inscriptions is in the configured parent IDs.
 *
 * Results are cached in memory to avoid redundant API calls.
 * If preFetchedParents is provided, skips the API call and uses the provided data.
 * Returns false on error (safe default — reject unverified inscriptions).
 */
export async function isCollectionInscription(
  inscription: InscriptionData,
  preFetchedParents?: string[]
): Promise<boolean> {
  // If no parent IDs configured, we can't filter by collection
  if (config.collection.parentInscriptionIds.length === 0) return true;

  // Check cache first
  const cached = collectionCache.get(inscription.inscriptionId);
  if (cached !== undefined) return cached;

  try {
    const parents = preFetchedParents !== undefined
      ? preFetchedParents
      : await fetchInscriptionInfo(inscription.inscriptionId).then((info) => info?.parents ?? null);

    if (!parents) return false;

    const configParents = new Set(config.collection.parentInscriptionIds);
    const isMatch = parents.some((pid) => configParents.has(pid));

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
