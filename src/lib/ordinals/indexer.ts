import config from "../../../marketplace.config";

/**
 * Ordinals Indexer Client
 *
 * Abstracts the ordinals indexer API (Unisat Open API primary, Hiro fallback).
 * Used for fetching inscription data, verifying ownership, and checking UTXOs.
 */

export interface InscriptionData {
  inscriptionId: string;
  inscriptionNumber: number;
  address: string;
  outputValue: number;
  contentType: string;
  contentLength: number;
  timestamp: number;
  genesisTransaction: string;
  location: string; // txid:vout:offset
  output: string; // txid:vout
  offset: number;
  preview?: string;
  contentUrl?: string;
}

export interface InscriptionUtxo {
  txid: string;
  vout: number;
  satoshi: number;
  scriptPk: string;
  scriptType: string;
  inscriptions: InscriptionData[];
}

export interface AddressUtxo {
  txid: string;
  vout: number;
  satoshi: number;
  scriptPk: string;
  scriptType: string;
  codeType: number;
  height: number;
  idx: number;
  isOpInRBF: boolean;
  inscriptions: string[];
}

interface UnisatApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}

interface PaginatedResponse<T> {
  list: T[];
  total: number;
}

/**
 * Actual Unisat API response shapes — the field names differ from our
 * internal PaginatedResponse. The indexer methods normalize them.
 */
interface UnisatInscriptionPageResponse {
  cursor: number;
  total: number;
  totalConfirmed: number;
  totalUnconfirmed: number;
  totalUnconfirmedSpend: number;
  inscription: Array<Record<string, unknown>>;
}

interface UnisatInscriptionUtxoPageResponse {
  cursor: number;
  total: number;
  totalConfirmed: number;
  totalUnconfirmed: number;
  totalUnconfirmedSpend: number;
  utxo: Array<Record<string, unknown>>;
}

class OrdinalsIndexer {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.indexer.baseUrl;
    this.apiKey = config.indexer.apiKey;
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, { headers });

    if (!res.ok) {
      throw new Error(
        `Indexer API error: ${res.status} ${res.statusText} for ${endpoint}`
      );
    }

    const json: UnisatApiResponse<T> = await res.json();

    if (json.code !== 0) {
      throw new Error(`Indexer API error: ${json.msg}`);
    }

    return json.data;
  }

  /**
   * Get inscription info by ID
   */
  async getInscription(inscriptionId: string): Promise<InscriptionData> {
    const data = await this.fetch<{
      inscriptionId: string;
      inscriptionNumber: number;
      address: string;
      outputValue: number;
      contentType: string;
      contentLength: number;
      timestamp: number;
      genesisTransaction: string;
      location: string;
      output: string;
      offset: number;
    }>(`/v1/indexer/inscription/info/${inscriptionId}`);

    return {
      ...data,
      contentUrl: `https://ordinals.com/content/${inscriptionId}`,
      preview: `https://ordinals.com/preview/${inscriptionId}`,
    };
  }

  /**
   * Get all inscriptions for an address
   */
  async getInscriptionsByAddress(
    address: string,
    cursor: number = 0,
    size: number = 100
  ): Promise<PaginatedResponse<InscriptionData>> {
    const data = await this.fetch<UnisatInscriptionPageResponse>(
      `/v1/indexer/address/${address}/inscription-data?cursor=${cursor}&size=${size}`
    );
    return {
      list: (data.inscription || []) as unknown as InscriptionData[],
      total: data.total,
    };
  }

  /**
   * Get inscription UTXOs for an address (excludes abandoned)
   */
  async getInscriptionUtxos(
    address: string,
    cursor: number = 0,
    size: number = 100
  ): Promise<PaginatedResponse<InscriptionUtxo>> {
    const data = await this.fetch<UnisatInscriptionUtxoPageResponse>(
      `/v1/indexer/address/${address}/inscription-utxo-data?cursor=${cursor}&size=${size}`
    );
    return {
      list: (data.utxo || []) as unknown as InscriptionUtxo[],
      total: data.total,
    };
  }

  /**
   * Get all UTXOs for an address (used for coin selection)
   */
  async getAddressUtxos(address: string): Promise<AddressUtxo[]> {
    // Use mempool.space API for UTXO fetching (more reliable for payment UTXOs)
    const res = await fetch(
      `https://mempool.space/api/address/${address}/utxo`
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch UTXOs for ${address}`);
    }
    const utxos = await res.json();
    return utxos.map((u: { txid: string; vout: number; value: number; status: { block_height: number } }) => ({
      txid: u.txid,
      vout: u.vout,
      satoshi: u.value,
      scriptPk: "",
      scriptType: "",
      codeType: 0,
      height: u.status?.block_height || 0,
      idx: 0,
      isOpInRBF: false,
      inscriptions: [],
    }));
  }

  /**
   * Check if a specific UTXO is still unspent
   */
  async isUtxoUnspent(txid: string, vout: number): Promise<boolean> {
    try {
      const res = await fetch(
        `https://mempool.space/api/tx/${txid}/outspend/${vout}`
      );
      if (!res.ok) return false;
      const data = await res.json();
      return !data.spent;
    } catch {
      return false;
    }
  }

  /**
   * Get the raw transaction hex
   */
  async getRawTransaction(txid: string): Promise<string> {
    const res = await fetch(`https://mempool.space/api/tx/${txid}/hex`);
    if (!res.ok) throw new Error(`Failed to fetch raw tx ${txid}`);
    return res.text();
  }

  /**
   * Get transaction details
   */
  async getTransaction(txid: string): Promise<{
    txid: string;
    status: { confirmed: boolean; block_height?: number };
    vin: Array<{ txid: string; vout: number; prevout: { value: number; scriptpubkey: string } }>;
    vout: Array<{ value: number; scriptpubkey: string; scriptpubkey_address: string }>;
  }> {
    const res = await fetch(`https://mempool.space/api/tx/${txid}`);
    if (!res.ok) throw new Error(`Failed to fetch tx ${txid}`);
    return res.json();
  }

  /**
   * Broadcast a raw transaction
   */
  async broadcastTransaction(txHex: string): Promise<string> {
    const res = await fetch("https://mempool.space/api/tx", {
      method: "POST",
      body: txHex,
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Broadcast failed: ${error}`);
    }
    return res.text(); // Returns txid
  }

  /**
   * Get inscription content URL
   */
  getContentUrl(inscriptionId: string): string {
    return `https://ordinals.com/content/${inscriptionId}`;
  }

  /**
   * Get inscription preview URL
   */
  getPreviewUrl(inscriptionId: string): string {
    return `https://ordinals.com/preview/${inscriptionId}`;
  }
}

// Singleton instance
export const indexer = new OrdinalsIndexer();
export default indexer;
