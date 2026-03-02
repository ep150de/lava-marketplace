import type {
  WalletAdapter,
  WalletAddress,
  SignPsbtOptions,
  SignPsbtResult,
  SignMessageOptions,
  SignMessageResult,
} from "./types";

/**
 * Unisat global window type
 */
interface UnisatAPI {
  requestAccounts(): Promise<string[]>;
  getAccounts(): Promise<string[]>;
  getPublicKey(): Promise<string>;
  getNetwork(): Promise<string>;
  getBalance(): Promise<{ confirmed: number; unconfirmed: number; total: number }>;
  getInscriptions(cursor: number, size: number): Promise<{
    total: number;
    list: Array<{
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
    }>;
  }>;
  signPsbt(
    psbtHex: string,
    options?: {
      autoFinalized?: boolean;
      toSignInputs?: Array<{
        index: number;
        address?: string;
        publicKey?: string;
        sighashTypes?: number[];
        useTweakedSigner?: boolean;
      }>;
    }
  ): Promise<string>;
  signPsbts(psbtHexs: string[], options?: unknown[]): Promise<string[]>;
  pushPsbt(psbtHex: string): Promise<string>;
  pushTx(rawTx: string): Promise<string>;
  signMessage(message: string, type?: string): Promise<string>;
  disconnect(): Promise<void>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  removeListener(event: string, handler: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    unisat?: UnisatAPI;
  }
}

/**
 * Convert base64 to hex
 */
function base64ToHex(base64: string): string {
  const binary = atob(base64);
  const hex = Array.from(binary)
    .map((ch) => ch.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
  return hex;
}

/**
 * Convert hex to base64
 */
function hexToBase64(hex: string): string {
  const binary = hex
    .match(/.{1,2}/g)!
    .map((byte) => String.fromCharCode(parseInt(byte, 16)))
    .join("");
  return btoa(binary);
}

/**
 * Unisat Wallet Adapter
 *
 * Uses the window.unisat API injected by the Unisat browser extension.
 * Unisat provides a single active address (which can be payment or ordinals).
 * PSBTs are handled in hex format — this adapter converts to/from base64.
 */
export class UnisatAdapter implements WalletAdapter {
  readonly type = "unisat" as const;

  private get api(): UnisatAPI {
    if (typeof window === "undefined" || !window.unisat) {
      throw new Error("Unisat wallet is not installed");
    }
    return window.unisat;
  }

  isAvailable(): boolean {
    if (typeof window === "undefined") return false;
    return !!window.unisat;
  }

  async connect(): Promise<WalletAddress[]> {
    const accounts = await this.api.requestAccounts();
    if (!accounts.length) {
      throw new Error("No accounts returned from Unisat");
    }

    const publicKey = await this.api.getPublicKey();
    const address = accounts[0];

    // Unisat returns a single address — we treat it as both payment and ordinals
    // (Unisat uses a single address model, typically Taproot)
    const addresses: WalletAddress[] = [
      {
        address,
        publicKey,
        purpose: "payment",
        addressType: address.startsWith("bc1p") ? "p2tr" : "p2wpkh",
      },
      {
        address,
        publicKey,
        purpose: "ordinals",
        addressType: address.startsWith("bc1p") ? "p2tr" : "p2wpkh",
      },
    ];

    return addresses;
  }

  async disconnect(): Promise<void> {
    // Unisat doesn't have a formal disconnect in older versions
    // Newer versions may support it
    try {
      await this.api.disconnect();
    } catch {
      // Silently ignore if not supported
    }
  }

  async signPsbt(options: SignPsbtOptions): Promise<SignPsbtResult> {
    // Convert base64 PSBT to hex (Unisat expects hex)
    const psbtHex = base64ToHex(options.psbt);

    const toSignInputs = options.signInputs.map((input) => ({
      index: input.index,
      address: input.address,
      sighashTypes: input.sighashTypes,
    }));

    const signedPsbtHex = await this.api.signPsbt(psbtHex, {
      autoFinalized: options.autoFinalize ?? false,
      toSignInputs,
    });

    // Convert signed hex PSBT back to base64
    const signedPsbtBase64 = hexToBase64(signedPsbtHex);

    let txid: string | undefined;
    if (options.broadcast) {
      txid = await this.api.pushPsbt(signedPsbtHex);
    }

    return {
      signedPsbt: signedPsbtBase64,
      txid,
    };
  }

  async broadcast(psbtBase64: string): Promise<string> {
    const psbtHex = base64ToHex(psbtBase64);
    return this.api.pushPsbt(psbtHex);
  }

  async signMessage(options: SignMessageOptions): Promise<SignMessageResult> {
    const signature = await this.api.signMessage(options.message);
    return { signature };
  }

  /**
   * Unisat-specific: Fetch inscriptions directly from the wallet
   */
  async getInscriptions(cursor: number = 0, size: number = 20) {
    return this.api.getInscriptions(cursor, size);
  }

  /**
   * Unisat-specific: Get wallet balance
   */
  async getBalance() {
    return this.api.getBalance();
  }
}
