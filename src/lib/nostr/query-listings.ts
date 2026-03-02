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
 * Query all active listings for a collection
 */
export async function queryListings(
  collectionSlug: string,
  options: {
    limit?: number;
    since?: number;
  } = {}
): Promise<ListingWithNostr[]> {
  const events = await queryEvents({
    kinds: [NOSTR_LISTING_KIND],
    "#L": [NOSTR_LABEL_NAMESPACE],
    "#l": ["listing"],
    "#collection": [collectionSlug],
    limit: options.limit || 100,
    since: options.since,
  });

  // Parse events into listing data
  const listings = events
    .map((event) => {
      try {
        return parseListingEvent(event);
      } catch {
        return null;
      }
    })
    .filter((l): l is ListingWithNostr => l !== null);

  // Deduplicate by inscription ID (keep most recent)
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
 * Query listings by a specific seller
 */
export async function querySellerListings(
  sellerNostrPubkey: string,
  collectionSlug: string
): Promise<ListingWithNostr[]> {
  const events = await queryEvents({
    kinds: [NOSTR_LISTING_KIND],
    authors: [sellerNostrPubkey],
    "#collection": [collectionSlug],
    limit: 50,
  });

  return events
    .map((event) => {
      try {
        return parseListingEvent(event);
      } catch {
        return null;
      }
    })
    .filter((l): l is ListingWithNostr => l !== null);
}

/**
 * Query a specific listing by inscription ID
 */
export async function queryListingByInscription(
  inscriptionId: string,
  collectionSlug: string
): Promise<ListingWithNostr | null> {
  const events = await queryEvents({
    kinds: [NOSTR_LISTING_KIND],
    "#inscription": [inscriptionId],
    "#collection": [collectionSlug],
    limit: 1,
  });

  if (events.length === 0) return null;

  try {
    return parseListingEvent(events[0]);
  } catch {
    return null;
  }
}
