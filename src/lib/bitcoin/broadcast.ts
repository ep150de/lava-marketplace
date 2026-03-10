import { BLOCKSTREAM_API, MEMPOOL_API } from "@/utils/constants";

const TX_BROADCAST_APIS = [
  { name: "mempool.space", url: `${MEMPOOL_API}/tx` },
  { name: "blockstream.info", url: `${BLOCKSTREAM_API}/tx` },
];

/**
 * Broadcast a raw Bitcoin transaction hex with fallback providers.
 *
 * Providers are tried sequentially. The first successful broadcast returns the txid.
 * If all providers fail, a combined error is thrown.
 */
export async function broadcastTxHex(txHex: string): Promise<string> {
  const failures: string[] = [];

  for (const provider of TX_BROADCAST_APIS) {
    try {
      const response = await fetch(provider.url, {
        method: "POST",
        body: txHex,
      });

      if (!response.ok) {
        const errText = await response.text();
        const failure = `${provider.name}: ${errText}`;
        failures.push(failure);
        console.warn(`[Broadcast] ${failure}`);
        continue;
      }

      const txid = await response.text();
      if (provider.name !== "mempool.space") {
        console.info(`[Broadcast] Broadcast succeeded via fallback provider ${provider.name}`);
      }
      return txid;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown network error";
      const failure = `${provider.name}: ${message}`;
      failures.push(failure);
      console.warn(`[Broadcast] ${failure}`);
    }
  }

  throw new Error(`Broadcast failed on all providers: ${failures.join("; ")}`);
}
