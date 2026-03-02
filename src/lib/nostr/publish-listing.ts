import { publishEvent } from "./client";
import {
  buildListingTags,
  NOSTR_LISTING_KIND,
  type ListingEventData,
} from "./event-schema";

/**
 * Publish a listing to Nostr relays
 *
 * Creates a NIP-78 (kind 30078) event containing the seller's signed PSBT
 * and all listing metadata as tags.
 */
export async function publishListing(
  data: ListingEventData,
  nostrPrivateKey: Uint8Array
): Promise<{ eventId: string; publishedAt: number }> {
  const tags = buildListingTags(data);

  const eventTemplate = {
    kind: NOSTR_LISTING_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: data.psbtBase64, // The signed PSBT as content
  };

  const event = await publishEvent(eventTemplate, nostrPrivateKey);

  return {
    eventId: event.id,
    publishedAt: event.created_at,
  };
}
