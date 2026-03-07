import { queryEvents } from "./client";
import { parseTimelockEvent, NOSTR_LISTING_KIND, type TimelockRecord } from "./timelock-schema";
import { NOSTR_LABEL_NAMESPACE, NOSTR_TIMELOCK_LABEL } from "@/utils/constants";
import { decrypt, getConversationKey } from "nostr-tools/nip44";
import { getPublicKey } from "nostr-tools";

/**
 * Query and decrypt timelock entries from Nostr relays.
 *
 * Only returns timelocks authored by the given private key (self-encrypted).
 * Uses NIP-44 decryption with the same key that encrypted them.
 */
export async function queryTimelocks(
  nostrPrivateKey: Uint8Array
): Promise<TimelockRecord[]> {
  const nostrPubkey = getPublicKey(nostrPrivateKey);

  // Query events authored by this user with the timelock label
  let events = await queryEvents({
    kinds: [NOSTR_LISTING_KIND],
    authors: [nostrPubkey],
    "#L": [NOSTR_LABEL_NAMESPACE],
    "#l": [NOSTR_TIMELOCK_LABEL],
    limit: 100,
  });

  // Fallback: broader query if targeted labels don't work on all relays
  if (events.length === 0) {
    events = await queryEvents({
      kinds: [NOSTR_LISTING_KIND],
      authors: [nostrPubkey],
      limit: 200,
    });
  }

  // Derive conversation key for self-decryption
  const conversationKey = getConversationKey(nostrPrivateKey, nostrPubkey);

  const timelocks: TimelockRecord[] = [];

  for (const event of events) {
    // Only process timelock events (check d-tag pattern)
    const dTag = event.tags.find((t) => t[0] === "d")?.[1];
    if (!dTag || !dTag.includes(":timelock:")) continue;

    try {
      // NIP-44 decrypt the content
      const decryptedContent = decrypt(event.content, conversationKey);
      const record = parseTimelockEvent(decryptedContent, event);
      if (record) {
        timelocks.push(record);
      }
    } catch (err) {
      console.warn("[Nostr] Failed to decrypt timelock event:", event.id, err);
      // Skip events we can't decrypt (different key, corrupted, etc.)
    }
  }

  // Deduplicate by lockTxid:lockVout (NIP-33 should handle this, but just in case)
  const byKey = new Map<string, TimelockRecord>();
  for (const tl of timelocks) {
    const key = `${tl.lockTxid}:${tl.lockVout}`;
    const existing = byKey.get(key);
    if (!existing || tl.createdAt > existing.createdAt) {
      byKey.set(key, tl);
    }
  }

  return Array.from(byKey.values()).sort((a, b) => b.createdAt - a.createdAt);
}
