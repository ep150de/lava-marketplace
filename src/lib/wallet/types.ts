/**
 * Unified wallet types shared across all wallet adapters
 */

export type WalletType = "xverse" | "unisat";

export type AddressPurpose = "payment" | "ordinals";

export interface WalletAddress {
  address: string;
  publicKey: string;
  purpose: AddressPurpose;
  addressType: string;
}

export interface WalletState {
  connected: boolean;
  type: WalletType | null;
  addresses: WalletAddress[];
  paymentAddress: string | null;
  paymentPublicKey: string | null;
  ordinalsAddress: string | null;
  ordinalsPublicKey: string | null;
}

export interface SignPsbtOptions {
  psbt: string; // Base64 encoded PSBT (adapters handle conversion)
  signInputs: {
    address: string;
    index: number;
    sighashTypes?: number[];
    /** When false, uses script-path Schnorr signing (for taproot script-path spends like CLTV timelocks).
     *  When true or undefined, uses tweaked key-path signing (standard taproot key-path spend). */
    useTweakedSigner?: boolean;
  }[];
  broadcast?: boolean;
  autoFinalize?: boolean;
}

export interface SignPsbtResult {
  signedPsbt: string; // Base64 encoded signed PSBT
  txid?: string; // Only if broadcast was true
}

export interface SignMessageOptions {
  address: string;
  message: string;
}

export interface SignMessageResult {
  signature: string;
  messageHash?: string;
}

export interface WalletAdapter {
  readonly type: WalletType;

  /** Check if the wallet extension is installed/available */
  isAvailable(): boolean;

  /** Connect to the wallet and get addresses */
  connect(): Promise<WalletAddress[]>;

  /** Disconnect from the wallet */
  disconnect(): Promise<void>;

  /** Sign a PSBT (handles format conversion internally) */
  signPsbt(options: SignPsbtOptions): Promise<SignPsbtResult>;

  /** Broadcast a signed transaction */
  broadcast(psbtOrTx: string): Promise<string>;

  /** Sign a message (used for Nostr key derivation) */
  signMessage(options: SignMessageOptions): Promise<SignMessageResult>;
}

export interface Inscription {
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
}

export const INITIAL_WALLET_STATE: WalletState = {
  connected: false,
  type: null,
  addresses: [],
  paymentAddress: null,
  paymentPublicKey: null,
  ordinalsAddress: null,
  ordinalsPublicKey: null,
};
