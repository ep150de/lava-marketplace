/**
 * Format satoshis to BTC string
 */
export function satsToBtc(sats: number): string {
  return (sats / 100_000_000).toFixed(8);
}

/**
 * Format BTC string to display (removes trailing zeros but keeps at least 4 decimals)
 */
export function formatBtc(sats: number): string {
  const btc = sats / 100_000_000;
  if (btc >= 1) return btc.toFixed(4);
  if (btc >= 0.01) return btc.toFixed(5);
  if (btc >= 0.0001) return btc.toFixed(6);
  return btc.toFixed(8);
}

/**
 * Format sats with comma separator
 */
export function formatSats(sats: number): string {
  return sats.toLocaleString("en-US");
}

/**
 * Truncate address for display
 */
export function truncateAddress(address: string, chars: number = 6): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Truncate inscription ID for display
 */
export function truncateInscriptionId(id: string, chars: number = 8): string {
  if (!id) return "";
  const [txid, index] = id.split("i");
  if (!txid) return id;
  return `${txid.slice(0, chars)}...i${index}`;
}

/**
 * Format relative time (e.g., "2m ago", "1h ago")
 */
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp * 1000;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

/**
 * Format a number with K/M suffix
 */
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
