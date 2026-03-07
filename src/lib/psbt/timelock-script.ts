import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "@bitcoinerlab/secp256k1";
import {
  UNSPENDABLE_INTERNAL_KEY,
  LEAF_VERSION_TAPSCRIPT,
  TIMELOCK_THRESHOLD,
} from "@/utils/constants";

// Initialize ECC library for bitcoinjs-lib
bitcoin.initEccLib(ecc);

/**
 * Timelock Script Builder
 *
 * Creates OP_CHECKLOCKTIMEVERIFY (CLTV) scripts wrapped in Taproot (P2TR)
 * using an unspendable internal key (NUMS point) so the ONLY spend path
 * is the script-path through the timelock.
 *
 * Script: <locktime> OP_CHECKLOCKTIMEVERIFY OP_DROP <ownerXOnlyPubkey> OP_CHECKSIG
 */

/**
 * Build a CLTV timelock script.
 *
 * @param locktime - Block height (< 500,000,000) or Unix timestamp (>= 500,000,000)
 * @param ownerXOnlyPubkey - 32-byte x-only public key of the owner (Buffer)
 * @returns Compiled script buffer
 */
export function buildTimelockScript(
  locktime: number,
  ownerXOnlyPubkey: Buffer
): Buffer {
  if (ownerXOnlyPubkey.length !== 32) {
    throw new Error(
      `Expected 32-byte x-only pubkey, got ${ownerXOnlyPubkey.length} bytes`
    );
  }

  if (locktime <= 0) {
    throw new Error("Locktime must be positive");
  }

  return Buffer.from(
    bitcoin.script.compile([
      bitcoin.script.number.encode(locktime),
      bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
      bitcoin.opcodes.OP_DROP,
      ownerXOnlyPubkey,
      bitcoin.opcodes.OP_CHECKSIG,
    ])
  );
}

/**
 * Create a P2TR timelock address from a CLTV script.
 *
 * Uses the NUMS unspendable internal key so the only spend path is
 * through the tapscript (no key-path bypass possible).
 *
 * @returns The P2TR address, output script, and the data needed to spend later
 */
export function createTimelockAddress(
  locktime: number,
  ownerXOnlyPubkey: Buffer
): {
  address: string;
  outputScript: Buffer;
  script: Buffer;
  internalPubkey: Buffer;
  controlBlock: Buffer;
  leafVersion: number;
} {
  const script = buildTimelockScript(locktime, ownerXOnlyPubkey);

  const internalPubkey = Buffer.from(UNSPENDABLE_INTERNAL_KEY, "hex");

  const scriptTree = {
    output: script,
  };

  const redeem = {
    output: script,
    redeemVersion: LEAF_VERSION_TAPSCRIPT,
  };

  const payment = bitcoin.payments.p2tr({
    internalPubkey,
    scriptTree,
    redeem,
    network: bitcoin.networks.bitcoin,
  });

  if (!payment.address) {
    throw new Error("Failed to derive P2TR timelock address");
  }

  if (!payment.witness || payment.witness.length < 2) {
    throw new Error("Failed to derive control block from P2TR payment");
  }

  // The control block is the last element in the witness stack
  const controlBlock = Buffer.from(payment.witness[payment.witness.length - 1]);

  return {
    address: payment.address,
    outputScript: Buffer.from(payment.output!),
    script,
    internalPubkey,
    controlBlock,
    leafVersion: LEAF_VERSION_TAPSCRIPT,
  };
}

/**
 * Convert a JavaScript Date to a locktime value (Unix timestamp).
 * Ensures the value is >= 500,000,000 (the CLTV boundary for timestamps).
 */
export function locktimeFromDate(date: Date): number {
  const timestamp = Math.floor(date.getTime() / 1000);
  if (timestamp < TIMELOCK_THRESHOLD) {
    throw new Error(
      `Date produces timestamp ${timestamp} which is below the CLTV threshold (${TIMELOCK_THRESHOLD}). ` +
      `This would be interpreted as a block height, not a timestamp.`
    );
  }
  return timestamp;
}

/**
 * Check if a locktime has expired relative to the current state.
 *
 * @param locktime - The locktime value from the script
 * @param currentBlockHeight - Current Bitcoin block height
 * @returns true if the timelock is expired and can be spent
 */
export function isLocktimeExpired(
  locktime: number,
  currentBlockHeight: number
): boolean {
  if (locktime < TIMELOCK_THRESHOLD) {
    // Block height comparison
    return currentBlockHeight >= locktime;
  } else {
    // Unix timestamp comparison
    const nowSeconds = Math.floor(Date.now() / 1000);
    return nowSeconds >= locktime;
  }
}

/**
 * Get the x-only (32-byte) public key from a potentially compressed (33-byte) key.
 */
export function toXOnlyPubkey(pubkey: Buffer | string): Buffer {
  const buf = typeof pubkey === "string" ? Buffer.from(pubkey, "hex") : pubkey;
  return buf.length === 33 ? buf.subarray(1) : buf;
}

/**
 * Format a locktime for display.
 */
export function formatLocktime(locktime: number): string {
  if (locktime < TIMELOCK_THRESHOLD) {
    return `Block #${locktime.toLocaleString()}`;
  } else {
    return new Date(locktime * 1000).toLocaleString();
  }
}

/**
 * Determine if a locktime is a block height or timestamp.
 */
export function isBlockHeightLocktime(locktime: number): boolean {
  return locktime < TIMELOCK_THRESHOLD;
}
