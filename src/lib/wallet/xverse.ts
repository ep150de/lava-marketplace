import { request, AddressPurpose } from "sats-connect";
import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "@bitcoinerlab/secp256k1";
import { broadcastTxHex } from "@/lib/bitcoin/broadcast";
import type {
  WalletAdapter,
  WalletAddress,
  SignPsbtOptions,
  SignPsbtResult,
  SignMessageOptions,
  SignMessageResult,
} from "./types";

// Initialize ECC library for bitcoinjs-lib (needed for taproot PSBT handling)
bitcoin.initEccLib(ecc);

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

  async broadcast(psbtBase64: string): Promise<string> {
    // Parse the signed PSBT and finalize any unfinalized inputs, then extract
    // the raw transaction and broadcast directly to mempool.space.
    //
    // Previously this method re-sent the PSBT through Xverse's signPsbt with
    // broadcast: true, but the extension's internal backend APIs rejected it
    // with a 400 error (AxiosError) because the PSBT wasn't in the state the
    // extension expected. Bypassing Xverse for broadcasting avoids this entirely.
    const network = bitcoin.networks.bitcoin;
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network });

    // Attempt to finalize each input — skip any that are already finalized
    for (let i = 0; i < psbt.inputCount; i++) {
      try {
        psbt.finalizeInput(i);
      } catch {
        // Input is likely already finalized or requires custom finalization
        // (e.g., tapscript CLTV inputs finalized earlier). Safe to skip.
      }
    }

    const txHex = psbt.extractTransaction().toHex();
    return broadcastTxHex(txHex);
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
