import { publishEvent } from "./client";
import {
  buildTimelockTags,
  NOSTR_LISTING_KIND,
  type TimelockEncryptedContent,
} from "./timelock-schema";
import { encrypt, getConversationKey } from "nostr-tools/nip44";
import { getPublicKey } from "nostr-tools";

/**
 * Publish a timelock entry to Nostr relays with NIP-44 encryption.
 *
 * The content is self-encrypted: we encrypt to our own pubkey so only
 * we can decrypt it later. Tags remain unencrypted for relay querying.
 */
export async function publishTimelock(
  data: TimelockEncryptedContent,
  nostrPrivateKey: Uint8Array
): Promise<{ eventId: string; publishedAt: number }> {
  const nostrPubkey = getPublicKey(nostrPrivateKey);

  // Build unencrypted tags
  const tags = buildTimelockTags(data.lockTxid, data.lockVout);

  // NIP-44 self-encrypt: encrypt the content to our own pubkey
  const plaintext = JSON.stringify(data);
  const conversationKey = getConversationKey(nostrPrivateKey, nostrPubkey);
  const encryptedContent = encrypt(plaintext, conversationKey);

  const eventTemplate = {
    kind: NOSTR_LISTING_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: encryptedContent,
  };

  const event = await publishEvent(eventTemplate, nostrPrivateKey);

  return {
    eventId: event.id,
    publishedAt: event.created_at,
  };
}

/**
 * Update a timelock entry (e.g., after unlocking).
 * NIP-33 replacement: same `d` tag replaces the previous event.
 */
export async function updateTimelockStatus(
  data: TimelockEncryptedContent,
  nostrPrivateKey: Uint8Array
): Promise<{ eventId: string }> {
  const { eventId } = await publishTimelock(data, nostrPrivateKey);
  return { eventId };
}
