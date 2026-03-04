// Bitcoin network constants
export const DUST_LIMIT = 546; // Minimum output value in sats
export const INSCRIPTION_OUTPUT_VALUE = 10000; // Safety buffer for inscription outputs
export const SIGHASH_SINGLE_ANYONECANPAY = 0x83; // SIGHASH_SINGLE | SIGHASH_ANYONECANPAY
export const SIGHASH_ALL = 0x01;
export const SIGHASH_DEFAULT = 0x00; // Taproot default (equivalent to ALL)

// Fee estimation
export const MIN_FEE_RATE = 0.15; // sat/vB minimum (supports sub-1 rates)
export const DUMMY_UTXO_VALUE = 1000; // Max value for preferred dummy UTXO (sats)
export const MEMPOOL_API = "https://mempool.space/api";

// Transaction size estimates (vbytes)
export const VBYTES_P2TR_INPUT = 57.5;
export const VBYTES_P2WPKH_INPUT = 68;
export const VBYTES_P2TR_OUTPUT = 43;
export const VBYTES_P2WPKH_OUTPUT = 31;
export const VBYTES_TX_OVERHEAD = 10.5;

// Nostr
export const NOSTR_LISTING_KIND = 30078;
export const NOSTR_LABEL_NAMESPACE = "lava-marketplace";

// Marketplace
export const MAX_LISTING_AGE_HOURS = 168; // 7 days before stale warning
export const LISTING_CHECK_INTERVAL_MS = 30000; // Check UTXO validity every 30s
