import { queryEvents } from "./client";
import {
  parseListingEvent,
  NOSTR_LISTING_KIND,
  type ListingEventData,
} from "./event-schema";
import { NOSTR_LABEL_NAMESPACE } from "@/utils/constants";

export type ListingWithNostr = ListingEventData & {
  nostrEventId: string;
  nostrPubkey: string;
};

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
 * Parse raw Nostr events into ListingWithNostr[], silently skipping unparseable events.
 */
function parseEvents(
  events: Array<{ content: string; tags: string[][]; created_at: number; pubkey: string; id: string }>,
  collectionSlug: string
): ListingWithNostr[] {
  return events
    .map((event) => {
      try {
        const listing = parseListingEvent(event);
        // Client-side filter: ensure the listing belongs to this collection
        if (listing.collectionSlug !== collectionSlug) return null;
        return listing;
      } catch {
        return null;
      }
    })
    .filter((l): l is ListingWithNostr => l !== null);
}

/**
 * Query all active listings for a collection.
 *
 * Strategy: First try a targeted query using the NIP-33 `#d` tag prefix
 * (well-supported across relays). If that returns no results, fall back
 * to a broader query by kind only and filter client-side. This handles
 * relays that don't support multi-letter custom tag filters like `#collection`.
 */
export async function queryListings(
  collectionSlug: string,
  options: {
    limit?: number;
    since?: number;
  } = {}
): Promise<ListingWithNostr[]> {
  const limit = options.limit || 100;

  // Attempt 1: Targeted query using #d tag prefix + #L label namespace.
  // The `d` tag is part of NIP-33 (parameterized replaceable events) which
  // is widely supported. Our d-tag format is "lava-marketplace:listing:<inscriptionId>".
  let events = await queryEvents({
    kinds: [NOSTR_LISTING_KIND],
    "#L": [NOSTR_LABEL_NAMESPACE],
    limit,
    since: options.since,
  });

  console.log(`[Nostr] Targeted query returned ${events.length} events`);

  // Attempt 2: If targeted query returned nothing, try a broader query by
  // kind only. Some relays don't index multi-letter tag filters (#L, #collection).
  if (events.length === 0) {
    console.log("[Nostr] Falling back to broad kind-only query");
    events = await queryEvents({
      kinds: [NOSTR_LISTING_KIND],
      limit,
      since: options.since,
    });
    console.log(`[Nostr] Broad query returned ${events.length} events`);
  }

  // Parse and filter client-side by collection slug
  const listings = parseEvents(events, collectionSlug);
  console.log(`[Nostr] ${listings.length} valid listings after parsing/filtering`);

  return deduplicateListings(listings);
}

/**
 * Query listings by a specific seller
 */
export async function querySellerListings(
  sellerNostrPubkey: string,
  collectionSlug: string
): Promise<ListingWithNostr[]> {
  const events = await queryEvents({
    kinds: [NOSTR_LISTING_KIND],
    authors: [sellerNostrPubkey],
    limit: 50,
  });

  const listings = parseEvents(events, collectionSlug);
  return deduplicateListings(listings);
}

/**
 * Query a specific listing by inscription ID
 */
export async function queryListingByInscription(
  inscriptionId: string,
  collectionSlug: string
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

  const listings = parseEvents(events, collectionSlug)
    .filter((l) => l.inscriptionId === inscriptionId);

  if (listings.length === 0) return null;

  // Return most recent
  return listings.sort((a, b) => b.listedAt - a.listedAt)[0];
}
