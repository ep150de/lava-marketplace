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
export const VBYTES_P2SH_P2WPKH_INPUT = 91; // Nested segwit (P2SH-P2WPKH) — larger due to redeemScript in scriptSig
export const VBYTES_P2TR_OUTPUT = 43;
export const VBYTES_P2WPKH_OUTPUT = 31;
export const VBYTES_TX_OVERHEAD = 10.5;

// Nostr
export const NOSTR_LISTING_KIND = 30078;
export const NOSTR_LABEL_NAMESPACE = "lava-marketplace";

// Marketplace
export const MAX_LISTING_AGE_HOURS = 168; // 7 days before stale warning
export const LISTING_CHECK_INTERVAL_MS = 30000; // Check UTXO validity every 30s

// Timelock (Trust Fund)
export const TIMELOCK_SEQUENCE = 0xfffffffe; // nSequence that enables CLTV but disables RBF-style relative lock
export const UNSPENDABLE_INTERNAL_KEY = "50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0"; // NUMS point — no key-path spend
export const LEAF_VERSION_TAPSCRIPT = 0xc0; // BIP-342 tapscript leaf version
export const TIMELOCK_MIN_OUTPUT_VALUE = 546; // Minimum output sats for timelocked UTXO
export const NOSTR_TIMELOCK_LABEL = "timelock"; // Nostr label for timelock events
export const TIMELOCK_LOCALSTORAGE_KEY = "lava-timelocks"; // localStorage backup key
export const TIMELOCK_THRESHOLD = 500_000_000; // Boundary: < this = block height, >= this = unix timestamp
