import { NOSTR_LISTING_KIND, NOSTR_LABEL_NAMESPACE } from "@/utils/constants";

/**
 * Nostr Event Schema for Marketplace Listings
 *
 * We use NIP-78 (kind 30078) for arbitrary app data, combined with
 * NIP-33 (parameterized replaceable events) so listings can be updated/cancelled.
 */

export interface ListingEventData {
  /** The seller's signed PSBT (base64) */
  psbtBase64: string;
  /** Collection slug */
  collectionSlug: string;
  /** Inscription ID */
  inscriptionId: string;
  /** Listing price in sats */
  priceSats: number;
  /** Seller's BTC address */
  sellerAddress: string;
  /** Ordinal UTXO (txid:vout) */
  utxo: string;
  /** Inscription offset within UTXO */
  inscriptionOffset: number;
  /** UTXO value in sats */
  utxoValue: number;
  /** Timestamp when listed */
  listedAt: number;
  /** Inscription content type */
  contentType?: string;
}

/**
 * Build Nostr event tags for a listing
 */
export function buildListingTags(data: ListingEventData): string[][] {
  return [
    // NIP-33: Parameterized replaceable event identifier
    ["d", `${NOSTR_LABEL_NAMESPACE}:listing:${data.inscriptionId}`],
    // Label tags
    ["L", NOSTR_LABEL_NAMESPACE],
    ["l", "listing", NOSTR_LABEL_NAMESPACE],
    // Marketplace data tags
    ["collection", data.collectionSlug],
    ["inscription", data.inscriptionId],
    ["price", data.priceSats.toString()],
    ["seller", data.sellerAddress],
    ["utxo", data.utxo],
    ["offset", data.inscriptionOffset.toString()],
    ["utxo_value", data.utxoValue.toString()],
    ["listed_at", data.listedAt.toString()],
    ...(data.contentType ? [["content_type", data.contentType]] : []),
  ];
}

/**
 * Parse a Nostr event back into listing data
 */
export function parseListingEvent(event: {
  content: string;
  tags: string[][];
  created_at: number;
  pubkey: string;
  id: string;
}): ListingEventData & { nostrEventId: string; nostrPubkey: string } {
  const getTag = (name: string): string => {
    const tag = event.tags.find((t) => t[0] === name);
    return tag ? tag[1] : "";
  };

  return {
    psbtBase64: event.content,
    collectionSlug: getTag("collection"),
    inscriptionId: getTag("inscription"),
    priceSats: parseInt(getTag("price"), 10) || 0,
    sellerAddress: getTag("seller"),
    utxo: getTag("utxo"),
    inscriptionOffset: parseInt(getTag("offset"), 10) || 0,
    utxoValue: parseInt(getTag("utxo_value"), 10) || 0,
    listedAt: parseInt(getTag("listed_at"), 10) || event.created_at,
    contentType: getTag("content_type") || undefined,
    nostrEventId: event.id,
    nostrPubkey: event.pubkey,
  };
}

/**
 * Build a cancellation event (NIP-09 deletion)
 */
export function buildCancellationTags(
  listingEventId: string,
  inscriptionId: string
): string[][] {
  return [
    ["e", listingEventId], // NIP-09: reference to event being deleted
    ["L", NOSTR_LABEL_NAMESPACE],
    ["l", "cancellation", NOSTR_LABEL_NAMESPACE],
    ["inscription", inscriptionId],
  ];
}

/**
 * Build a NIP-33 replacement event that supersedes the original listing.
 * Since kind 30078 is a parameterized replaceable event (kind 30000-39999),
 * publishing a new event with the same `d` tag from the same pubkey causes
 * relays to replace the old event automatically. This is more reliable than
 * NIP-09 deletion which is merely advisory.
 */
export function buildCancellationReplacementTags(
  inscriptionId: string,
  collectionSlug: string
): string[][] {
  return [
    // Same d-tag as the original listing — triggers NIP-33 replacement
    ["d", `${NOSTR_LABEL_NAMESPACE}:listing:${inscriptionId}`],
    ["L", NOSTR_LABEL_NAMESPACE],
    ["l", "cancellation", NOSTR_LABEL_NAMESPACE],
    ["status", "cancelled"],
    ["collection", collectionSlug],
    ["inscription", inscriptionId],
  ];
}

export { NOSTR_LISTING_KIND };
