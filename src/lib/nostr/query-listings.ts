import { queryEvents } from "./client";
import {
  parseListingEvent,
  NOSTR_LISTING_KIND,
  type ListingEventData,
  type MarketScope,
} from "./event-schema";
import { NOSTR_LABEL_NAMESPACE } from "@/utils/constants";

export type ListingWithNostr = ListingEventData & {
  nostrEventId: string;
  nostrPubkey: string;
};

export type ListingQueryScope = MarketScope | "all";

function resolveListingScope(listing: ListingWithNostr): MarketScope {
  if (listing.marketScope === "lava-lamps" || listing.marketScope === "all-ordinals") {
    return listing.marketScope;
  }

  return listing.collectionSlug === "all-ordinals" ? "all-ordinals" : "lava-lamps";
}

/**
 * Deduplicate listings by inscription ID, keeping the most recent per inscription.
 */
function deduplicateListings(listings: ListingWithNostr[]): ListingWithNostr[] {
  const byInscription = new Map<string, ListingWithNostr>();
  for (const listing of listings) {
    const existing = byInscription.get(listing.inscriptionId);
    if (!existing || listing.listedAt > existing.listedAt) {
      byInscription.set(listing.inscriptionId, listing);
    }
  }
  return Array.from(byInscription.values());
}

/**
 * Check if a raw Nostr event has a "cancelled" status tag.
 * This is set by our NIP-33 replacement cancellation mechanism.
 */
function isCancelledEvent(event: { tags: string[][] }): boolean {
  return event.tags.some(
    (t) => t[0] === "status" && t[1] === "cancelled"
  );
}

/**
 * Check if a raw Nostr event has empty content (cancelled replacement events
 * have empty PSBT content).
 */
function hasEmptyContent(event: { content: string }): boolean {
  return !event.content || event.content.trim() === "";
}

/**
 * Collect event IDs that have been deleted via NIP-09 (kind 5) events.
 */
function collectDeletedEventIds(
  deletionEvents: Array<{ tags: string[][] }>
): Set<string> {
  const deleted = new Set<string>();
  for (const event of deletionEvents) {
    for (const tag of event.tags) {
      if (tag[0] === "e" && tag[1]) {
        deleted.add(tag[1]);
      }
    }
  }
  return deleted;
}

/**
 * Parse raw Nostr events into ListingWithNostr[], silently skipping unparseable events.
 * When collectionSlug is null, all collections are returned (no client-side filtering).
 * Filters out events that are cancelled (status tag) or have empty content.
 */
function parseEvents(
  events: Array<{ content: string; tags: string[][]; created_at: number; pubkey: string; id: string }>,
  scope: ListingQueryScope
): ListingWithNostr[] {
  return events
    .map((event) => {
      try {
        // Skip cancelled NIP-33 replacement events
        if (isCancelledEvent(event) || hasEmptyContent(event)) return null;

        const listing = parseListingEvent(event);
        const listingScope = resolveListingScope(listing);
        if (scope !== "all" && listingScope !== scope) return null;
        return listing;
      } catch {
        return null;
      }
    })
    .filter((l): l is ListingWithNostr => l !== null);
}

/**
 * Query NIP-09 deletion events from the same relays.
 * Returns a set of event IDs that have been marked for deletion.
 */
async function fetchDeletedEventIds(): Promise<Set<string>> {
  try {
    const deletionEvents = await queryEvents({
      kinds: [5],
      "#L": [NOSTR_LABEL_NAMESPACE],
      limit: 200,
    });

    // If targeted query returns nothing, try broad fallback
    if (deletionEvents.length === 0) {
      const broadDeletions = await queryEvents({
        kinds: [5],
        limit: 200,
      });
      return collectDeletedEventIds(broadDeletions);
    }

    return collectDeletedEventIds(deletionEvents);
  } catch (err) {
    console.warn("[Nostr] Failed to fetch deletion events:", err);
    return new Set();
  }
}

/**
 * Query all active listings for a collection.
 *
 * Strategy:
 * 1. Query kind 30078 listing events (targeted #L filter, then broad fallback)
 * 2. Query kind 5 deletion events to build a set of deleted event IDs
 * 3. Filter out: cancelled events (status tag), empty content, and NIP-09 deleted events
 * 4. Deduplicate by inscription ID, keeping most recent
 */
export async function queryListings(
  scope: ListingQueryScope = "lava-lamps",
  options: {
    limit?: number;
    since?: number;
  } = {}
): Promise<ListingWithNostr[]> {
  const limit = options.limit || 100;

  // Fetch listings and deletion events in parallel
  const [listingEvents, deletedIds] = await Promise.all([
    (async () => {
      // Attempt 1: Targeted query using #L label namespace
      let events = await queryEvents({
        kinds: [NOSTR_LISTING_KIND],
        "#L": [NOSTR_LABEL_NAMESPACE],
        limit,
        since: options.since,
      });

      console.log(`[Nostr] Targeted query returned ${events.length} events`);

      // Attempt 2: Broad fallback by kind only
      if (events.length === 0) {
        console.log("[Nostr] Falling back to broad kind-only query");
        events = await queryEvents({
          kinds: [NOSTR_LISTING_KIND],
          limit,
          since: options.since,
        });
        console.log(`[Nostr] Broad query returned ${events.length} events`);
      }

      return events;
    })(),
    fetchDeletedEventIds(),
  ]);

  // Parse events, filtering out cancelled/empty ones
  let listings = parseEvents(listingEvents, scope);

  // Filter out NIP-09 deleted listings
  if (deletedIds.size > 0) {
    const before = listings.length;
    listings = listings.filter((l) => !deletedIds.has(l.nostrEventId));
    const removed = before - listings.length;
    if (removed > 0) {
      console.log(`[Nostr] Filtered out ${removed} NIP-09 deleted listings`);
    }
  }

  console.log(`[Nostr] ${listings.length} active listings after filtering`);

  return deduplicateListings(listings);
}

/**
 * Query listings by a specific seller
 */
export async function querySellerListings(
  sellerNostrPubkey: string,
  scope: ListingQueryScope = "lava-lamps"
): Promise<ListingWithNostr[]> {
  const [events, deletedIds] = await Promise.all([
    queryEvents({
      kinds: [NOSTR_LISTING_KIND],
      authors: [sellerNostrPubkey],
      limit: 50,
    }),
    fetchDeletedEventIds(),
  ]);

  let listings = parseEvents(events, scope);
  listings = listings.filter((l) => !deletedIds.has(l.nostrEventId));
  return deduplicateListings(listings);
}

/**
 * Query a specific listing by inscription ID
 */
export async function queryListingByInscription(
  inscriptionId: string,
  scope: ListingQueryScope = "all"
): Promise<ListingWithNostr | null> {
  // Try targeted query with #inscription tag first
  let events = await queryEvents({
    kinds: [NOSTR_LISTING_KIND],
    "#inscription": [inscriptionId],
    limit: 5,
  });

  // Fallback: broader query, filter client-side
  if (events.length === 0) {
    events = await queryEvents({
      kinds: [NOSTR_LISTING_KIND],
      limit: 100,
    });
  }

  const deletedIds = await fetchDeletedEventIds();

  const listings = parseEvents(events, scope)
    .filter((l) => l.inscriptionId === inscriptionId)
    .filter((l) => !deletedIds.has(l.nostrEventId));

  if (listings.length === 0) return null;

  // Return most recent
  return listings.sort((a, b) => b.listedAt - a.listedAt)[0];
}
