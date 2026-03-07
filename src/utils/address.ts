/**
 * Validate a Bitcoin mainnet address
 */
export function isValidBitcoinAddress(address: string): boolean {
  // P2PKH (legacy) - starts with 1
  if (/^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) return true;
  // P2SH - starts with 3
  if (/^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) return true;
  // Bech32 (P2WPKH/P2WSH) - starts with bc1q
  if (/^bc1q[a-z0-9]{38,58}$/.test(address)) return true;
  // Bech32m (P2TR/Taproot) - starts with bc1p
  if (/^bc1p[a-z0-9]{58}$/.test(address)) return true;
  return false;
}

/**
 * Validate a Bitcoin testnet address
 */
export function isValidTestnetAddress(address: string): boolean {
  if (/^[mn][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) return true;
  if (/^2[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) return true;
  if (/^tb1q[a-z0-9]{38,58}$/.test(address)) return true;
  if (/^tb1p[a-z0-9]{58}$/.test(address)) return true;
  return false;
}

/**
 * Determine address type
 */
export function getAddressType(
  address: string
): "p2pkh" | "p2sh" | "p2wpkh" | "p2wsh" | "p2tr" | "unknown" {
  if (address.startsWith("1") || address.startsWith("m") || address.startsWith("n"))
    return "p2pkh";
  if (address.startsWith("3") || address.startsWith("2")) return "p2sh";
  if (address.startsWith("bc1q") || address.startsWith("tb1q")) {
    return address.length === 42 ? "p2wpkh" : "p2wsh";
  }
  if (address.startsWith("bc1p") || address.startsWith("tb1p")) return "p2tr";
  return "unknown";
}

/**
 * Check if an address is a Taproot address
 */
export function isTaprootAddress(address: string): boolean {
  return getAddressType(address) === "p2tr";
}

/**
 * Check if an address is a P2SH address (e.g., nested segwit P2SH-P2WPKH)
 */
export function isP2shAddress(address: string): boolean {
  return getAddressType(address) === "p2sh";
}
