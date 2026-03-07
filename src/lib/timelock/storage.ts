import { TIMELOCK_LOCALSTORAGE_KEY } from "@/utils/constants";
import type { TimelockEncryptedContent } from "@/lib/nostr/timelock-schema";

/**
 * localStorage backup layer for timelock records.
 *
 * This provides a local cache/backup of timelock data so users don't
 * lose access to their timelock spending data if Nostr relays are unreachable.
 * The data stored here is NOT encrypted (it's local to the user's browser).
 */

/**
 * Get the storage key scoped to a specific owner address.
 */
function getStorageKey(ownerAddress: string): string {
  return `${TIMELOCK_LOCALSTORAGE_KEY}:${ownerAddress}`;
}

/**
 * Load all timelocks from localStorage for a given owner.
 */
export function loadTimelocks(ownerAddress: string): TimelockEncryptedContent[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(getStorageKey(ownerAddress));
    if (!raw) return [];
    return JSON.parse(raw) as TimelockEncryptedContent[];
  } catch (err) {
    console.warn("[TimelockStorage] Failed to load from localStorage:", err);
    return [];
  }
}

/**
 * Save a timelock to localStorage.
 * Deduplicates by lockTxid:lockVout, keeping the latest version.
 */
export function saveTimelock(
  ownerAddress: string,
  timelock: TimelockEncryptedContent
): void {
  if (typeof window === "undefined") return;

  try {
    const existing = loadTimelocks(ownerAddress);
    const key = `${timelock.lockTxid}:${timelock.lockVout}`;

    // Replace existing entry or add new
    const idx = existing.findIndex(
      (t) => `${t.lockTxid}:${t.lockVout}` === key
    );
    if (idx >= 0) {
      existing[idx] = timelock;
    } else {
      existing.push(timelock);
    }

    localStorage.setItem(getStorageKey(ownerAddress), JSON.stringify(existing));
  } catch (err) {
    console.warn("[TimelockStorage] Failed to save to localStorage:", err);
  }
}

/**
 * Update a timelock's status in localStorage.
 */
export function updateTimelockInStorage(
  ownerAddress: string,
  lockTxid: string,
  lockVout: number,
  updates: Partial<TimelockEncryptedContent>
): void {
  if (typeof window === "undefined") return;

  try {
    const existing = loadTimelocks(ownerAddress);
    const key = `${lockTxid}:${lockVout}`;
    const idx = existing.findIndex(
      (t) => `${t.lockTxid}:${t.lockVout}` === key
    );
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...updates };
      localStorage.setItem(getStorageKey(ownerAddress), JSON.stringify(existing));
    }
  } catch (err) {
    console.warn("[TimelockStorage] Failed to update localStorage:", err);
  }
}

/**
 * Remove a timelock from localStorage.
 */
export function removeTimelockFromStorage(
  ownerAddress: string,
  lockTxid: string,
  lockVout: number
): void {
  if (typeof window === "undefined") return;

  try {
    const existing = loadTimelocks(ownerAddress);
    const key = `${lockTxid}:${lockVout}`;
    const filtered = existing.filter(
      (t) => `${t.lockTxid}:${t.lockVout}` !== key
    );
    localStorage.setItem(getStorageKey(ownerAddress), JSON.stringify(filtered));
  } catch (err) {
    console.warn("[TimelockStorage] Failed to remove from localStorage:", err);
  }
}

/**
 * Clear all timelocks from localStorage for a given owner.
 */
export function clearTimelocks(ownerAddress: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(getStorageKey(ownerAddress));
}
