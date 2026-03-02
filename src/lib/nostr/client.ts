import {
  SimplePool,
  finalizeEvent,
  getPublicKey,
  type EventTemplate,
  type Event as NostrEvent,
} from "nostr-tools";
import { sha256 } from "@noble/hashes/sha256";
import config from "../../../marketplace.config";

/**
 * Nostr Client
 *
 * Handles relay connections, event publishing, and querying.
 * Uses nostr-tools SimplePool for multi-relay operations.
 *
 * Nostr key derivation: We derive a Nostr keypair from a Bitcoin
 * wallet signature to avoid requiring users to have a separate Nostr identity.
 */

const NOSTR_KEY_MESSAGE =
  "Sign this message to derive your Nostr identity for LAVA TERMINAL marketplace.\n\n" +
  "This does NOT grant access to your Bitcoin or ordinals.\n" +
  "It only creates a signing key for marketplace listings.";

/**
 * Derive a Nostr private key from a Bitcoin wallet message signature.
 * The signature is hashed with SHA-256 to produce a 32-byte private key.
 */
export function deriveNostrPrivateKey(btcSignature: string): Uint8Array {
  const hash = sha256(new TextEncoder().encode(btcSignature));
  return hash;
}

/**
 * Get the message that needs to be signed to derive a Nostr key
 */
export function getNostrKeyDerivationMessage(): string {
  return NOSTR_KEY_MESSAGE;
}

/**
 * Derive full Nostr keypair from a BTC signature
 */
export function deriveNostrKeypair(btcSignature: string): {
  privateKey: Uint8Array;
  publicKey: string;
} {
  const privateKey = deriveNostrPrivateKey(btcSignature);
  const publicKey = getPublicKey(privateKey);
  return { privateKey, publicKey };
}

// Singleton pool instance
let pool: SimplePool | null = null;

function getPool(): SimplePool {
  if (!pool) {
    pool = new SimplePool();
  }
  return pool;
}

function getRelayUrls(): string[] {
  return config.nostr.relays;
}

/**
 * Connect to all configured relays (for compatibility — pool handles this lazily)
 */
export async function connectToRelays(): Promise<string[]> {
  return getRelayUrls();
}

/**
 * Publish an event to all configured relays
 */
export async function publishEvent(
  eventTemplate: EventTemplate,
  privateKey: Uint8Array
): Promise<NostrEvent> {
  const event = finalizeEvent(eventTemplate, privateKey);
  const p = getPool();
  const relays = getRelayUrls();

  const results = await Promise.allSettled(
    relays.map(async (url) => {
      // Race against a 10s timeout per relay
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout publishing to ${url}`)), 10_000)
      );
      await Promise.race([p.publish([url], event), timeout]);
      return url;
    })
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected");
  for (const f of failed) {
    console.warn("Relay publish failed:", (f as PromiseRejectedResult).reason);
  }

  if (succeeded === 0) {
    throw new Error(
      "Failed to publish to any relay. Please check your connection and try again."
    );
  }

  console.log(`Published to ${succeeded}/${relays.length} relays`);
  return event;
}

/**
 * Query events from relays with a filter
 */
export async function queryEvents(
  filter: {
    kinds?: number[];
    authors?: string[];
    "#d"?: string[];
    "#L"?: string[];
    "#l"?: string[];
    "#collection"?: string[];
    "#inscription"?: string[];
    since?: number;
    until?: number;
    limit?: number;
  }
): Promise<NostrEvent[]> {
  const p = getPool();
  const relays = getRelayUrls();

  try {
    // Race against a 15s timeout so a dead relay can't hang the UI
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Relay query timed out")), 15_000)
    );
    const events = await Promise.race([
      p.querySync(relays, filter),
      timeout,
    ]);

    // Deduplicate by event ID
    const seen = new Map<string, NostrEvent>();
    for (const event of events) {
      if (!seen.has(event.id)) {
        seen.set(event.id, event);
      }
    }

    // Sort by created_at descending
    return Array.from(seen.values()).sort(
      (a, b) => b.created_at - a.created_at
    );
  } catch (err) {
    console.error("Failed to query Nostr relays:", err);
    return [];
  }
}

/**
 * Close all relay connections
 */
export function closeAllRelays(): void {
  if (pool) {
    pool.close(getRelayUrls());
    pool = null;
  }
}
