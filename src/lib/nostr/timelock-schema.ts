import {
  NOSTR_LISTING_KIND,
  NOSTR_LABEL_NAMESPACE,
  NOSTR_TIMELOCK_LABEL,
} from "@/utils/constants";
import type { TimelockMode } from "@/lib/psbt/create-timelock";

/**
 * Nostr Event Schema for Timelock (Trust Fund) entries
 *
 * Uses NIP-78 (kind 30078) parameterized replaceable events.
 * Content is NIP-44 encrypted (self-encrypt) for privacy.
 * Tags remain unencrypted so relays can filter by author + label.
 */

/**
 * The data encrypted inside the event content (NIP-44).
 */
export interface TimelockEncryptedContent {
  /** Lock mode: inscription or sats */
  mode: TimelockMode;
  /** The locktime value (block height or unix timestamp) */
  locktime: number;
  /** The timelock P2TR address */
  timelockAddress: string;
  /** Timelock script hex — needed for unlocking */
  timelockScriptHex: string;
  /** Control block hex — needed for unlocking */
  controlBlockHex: string;
  /** Internal pubkey hex — needed for unlocking */
  internalPubkeyHex: string;
  /** Value locked in the timelock output (sats) */
  lockedValueSats: number;
  /** Lock transaction txid */
  lockTxid: string;
  /** Lock transaction output index (which vout holds the timelock) */
  lockVout: number;
  /** Owner's ordinals address */
  ordinalsAddress: string;
  /** Owner's ordinals public key (hex) */
  ordinalsPublicKey: string;
  /** Owner's payment address */
  paymentAddress: string;
  /** Owner's payment public key (hex) */
  paymentPublicKey: string;
  /** Inscription ID (only for inscription mode) */
  inscriptionId?: string;
  /** Inscription number (only for inscription mode) */
  inscriptionNumber?: number;
  /** Unlock transaction txid (set when unlocked) */
  unlockTxid?: string;
  /** Status */
  status: "locked" | "unlocked" | "expired";
  /** Timestamp when the lock was created */
  createdAt: number;
  /** Optional user-provided label/note */
  label?: string;
}

/**
 * Full timelock record (encrypted content + Nostr metadata)
 */
export interface TimelockRecord extends TimelockEncryptedContent {
  /** Nostr event ID */
  nostrEventId: string;
  /** Nostr author pubkey */
  nostrPubkey: string;
}

/**
 * Build Nostr event tags for a timelock entry.
 * Tags are UNENCRYPTED for relay querying.
 */
export function buildTimelockTags(lockTxid: string, lockVout: number): string[][] {
  return [
    // NIP-33: Parameterized replaceable event identifier
    ["d", `${NOSTR_LABEL_NAMESPACE}:timelock:${lockTxid}:${lockVout}`],
    // Label tags for querying
    ["L", NOSTR_LABEL_NAMESPACE],
    ["l", NOSTR_TIMELOCK_LABEL, NOSTR_LABEL_NAMESPACE],
  ];
}

/**
 * Parse a Nostr event into a TimelockRecord.
 * Expects the content to already be decrypted.
 */
export function parseTimelockEvent(
  decryptedContent: string,
  event: { id: string; pubkey: string }
): TimelockRecord | null {
  try {
    const data = JSON.parse(decryptedContent) as TimelockEncryptedContent;

    // Basic validation
    if (!data.lockTxid || !data.timelockAddress || !data.locktime) {
      return null;
    }

    return {
      ...data,
      nostrEventId: event.id,
      nostrPubkey: event.pubkey,
    };
  } catch {
    return null;
  }
}

/**
 * Build the `d` tag value for a timelock event.
 */
export function getTimelockDTag(lockTxid: string, lockVout: number): string {
  return `${NOSTR_LABEL_NAMESPACE}:timelock:${lockTxid}:${lockVout}`;
}

export { NOSTR_LISTING_KIND };
