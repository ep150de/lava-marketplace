import { publishEvent } from "./client";
import {
  buildCancellationTags,
  buildCancellationReplacementTags,
  NOSTR_LISTING_KIND,
} from "./event-schema";

/**
 * Cancel a listing using two complementary mechanisms:
 *
 * 1. NIP-33 replacement (primary): Publish a new kind 30078 event with the
 *    same `d` tag but status "cancelled" and empty content. Since kind 30078
 *    is a parameterized replaceable event (kind 30000-39999), relays MUST
 *    replace the old listing event with this one. This is the most reliable
 *    cancellation method.
 *
 * 2. NIP-09 deletion (backup): Publish a kind 5 event referencing the old
 *    listing event ID. This is advisory — relays may or may not honor it.
 *
 * On the query side, we also filter out events with status "cancelled" and
 * cross-reference kind 5 deletion events, so even if a relay keeps
 * everything, cancelled listings won't appear in the UI.
 */
export async function cancelListing(
  listingEventId: string,
  inscriptionId: string,
  collectionSlug: string,
  nostrPrivateKey: Uint8Array
): Promise<{ cancellationEventId: string }> {
  // Primary: NIP-33 replacement — replaces the original listing on all conforming relays
  const replacementTags = buildCancellationReplacementTags(inscriptionId, collectionSlug);
  const replacementEvent = await publishEvent(
    {
      kind: NOSTR_LISTING_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: replacementTags,
      content: "", // Empty content — no PSBT
    },
    nostrPrivateKey
  );

  // Backup: NIP-09 deletion event
  const deletionTags = buildCancellationTags(listingEventId, inscriptionId);
  try {
    await publishEvent(
      {
        kind: 5, // NIP-09 Event Deletion
        created_at: Math.floor(Date.now() / 1000),
        tags: deletionTags,
        content: "Listing cancelled",
      },
      nostrPrivateKey
    );
  } catch (err) {
    // Non-fatal — the NIP-33 replacement is the primary mechanism
    console.warn("NIP-09 deletion publish failed (non-fatal):", err);
  }

  return {
    cancellationEventId: replacementEvent.id,
  };
}
