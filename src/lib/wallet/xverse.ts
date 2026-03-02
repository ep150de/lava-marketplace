import { request, AddressPurpose } from "sats-connect";
import type {
  WalletAdapter,
  WalletAddress,
  SignPsbtOptions,
  SignPsbtResult,
  SignMessageOptions,
  SignMessageResult,
} from "./types";

/**
 * The provider ID tells sats-connect's core request() to resolve the provider
 * via getProviderById(), which splits on "." and traverses the window object:
 * window.XverseProviders.BitcoinProvider
 *
 * Without this, the core request() falls back to the generic
 * window.BitcoinProvider lookup which may be uninitialized or missing,
 * causing "Failed to get selected account while checking permissions."
 */
const XVERSE_PROVIDER_ID = "XverseProviders.BitcoinProvider";

/**
 * Xverse Wallet Adapter
 *
 * Uses the sats-connect library to interface with the Xverse browser extension.
 * Xverse provides separate payment (P2WPKH) and ordinals (P2TR) addresses.
 * PSBTs are handled in Base64 format natively.
 */
export class XverseAdapter implements WalletAdapter {
  readonly type = "xverse" as const;

  isAvailable(): boolean {
    if (typeof window === "undefined") return false;
    // Check both provider paths that Xverse may inject
    const win = window as unknown as Record<string, unknown>;
    const xverseProviders = win.XverseProviders as
      | Record<string, unknown>
      | undefined;
    return !!xverseProviders?.BitcoinProvider || !!win.BitcoinProvider;
  }

  async connect(): Promise<WalletAddress[]> {
    const response = await request(
      "wallet_connect",
      {
        addresses: [AddressPurpose.Payment, AddressPurpose.Ordinals],
        message: "Connect to LAVA TERMINAL",
      },
      XVERSE_PROVIDER_ID
    );

    if (response.status === "error") {
      const msg = response.error?.message || "Unknown error";

      // Detect locked wallet / no selected account — the Xverse extension
      // returns this when its internal getSelectedAccount() finds no account,
      // typically because the wallet is locked after a browser restart.
      if (msg.toLowerCase().includes("failed to get selected account")) {
        throw new Error(
          "Xverse wallet appears to be locked. Please open the Xverse extension, unlock it with your password, and try again."
        );
      }

      throw new Error(`Xverse connection failed: ${msg}`);
    }

    const rawAddresses = response.result.addresses;
    const addresses: WalletAddress[] = [];

    for (const addr of rawAddresses) {
      const purpose =
        (addr.purpose as string) === "ordinals" ? "ordinals" : "payment";
      addresses.push({
        address: addr.address,
        publicKey: addr.publicKey,
        purpose,
        addressType: addr.addressType,
      });
    }

    return addresses;
  }

  async disconnect(): Promise<void> {
    try {
      await request("wallet_disconnect", null, XVERSE_PROVIDER_ID);
    } catch {
      // Xverse may not support disconnect; fail silently
    }
  }

  async signPsbt(options: SignPsbtOptions): Promise<SignPsbtResult> {
    // Xverse expects base64 PSBT and signInputs as Record<address, number[]>
    const signInputsMap: Record<string, number[]> = {};
    for (const input of options.signInputs) {
      if (!signInputsMap[input.address]) {
        signInputsMap[input.address] = [];
      }
      signInputsMap[input.address].push(input.index);
    }

    const response = await request(
      "signPsbt",
      {
        psbt: options.psbt, // base64
        signInputs: signInputsMap,
        broadcast: options.broadcast ?? false,
      },
      XVERSE_PROVIDER_ID
    );

    if (response.status === "error") {
      throw new Error(
        `Xverse PSBT signing failed: ${response.error?.message || "Unknown error"}`
      );
    }

    return {
      signedPsbt: response.result.psbt,
      txid: response.result.txid,
    };
  }

  async broadcast(psbt: string): Promise<string> {
    // Xverse can broadcast during signPsbt, but we also support standalone broadcast
    const response = await request(
      "signPsbt",
      {
        psbt,
        signInputs: {},
        broadcast: true,
      },
      XVERSE_PROVIDER_ID
    );

    if (response.status === "error") {
      throw new Error(
        `Xverse broadcast failed: ${response.error?.message || "Unknown error"}`
      );
    }

    return response.result.txid || "";
  }

  async signMessage(options: SignMessageOptions): Promise<SignMessageResult> {
    const response = await request(
      "signMessage",
      {
        address: options.address,
        message: options.message,
      },
      XVERSE_PROVIDER_ID
    );

    if (response.status === "error") {
      throw new Error(
        `Xverse message signing failed: ${response.error?.message || "Unknown error"}`
      );
    }

    return {
      signature: response.result.signature,
    };
  }
}
