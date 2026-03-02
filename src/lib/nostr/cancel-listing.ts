import { publishEvent } from "./client";
import { buildCancellationTags } from "./event-schema";

/**
 * Cancel a listing by publishing a NIP-09 deletion event
 */
export async function cancelListing(
  listingEventId: string,
  inscriptionId: string,
  nostrPrivateKey: Uint8Array
): Promise<{ cancellationEventId: string }> {
  const tags = buildCancellationTags(listingEventId, inscriptionId);

  const eventTemplate = {
    kind: 5, // NIP-09 Event Deletion
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: "Listing cancelled",
  };

  const event = await publishEvent(eventTemplate, nostrPrivateKey);

  return {
    cancellationEventId: event.id,
  };
}
