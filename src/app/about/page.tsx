"use client";

import React from "react";
import config from "../../../marketplace.config";
import { useMarketplaceContext } from "@/context/MarketplaceContext";

export default function AboutPage() {
  const { blockHeight } = useMarketplaceContext();

  // Mystery color based on block height
  const mysteryColorIndex = blockHeight ? blockHeight % 360 : 0;

  return (
    <div className="space-y-6 font-mono max-w-3xl mx-auto">
      {/* Header */}
      <div className="border-b border-crt-dim pb-3">
        <div className="text-crt-bright text-lg">ABOUT</div>
      </div>

      {/* Collection info */}
      <div className="border border-crt-border p-4 space-y-3">
        <div className="text-crt-bright text-sm border-b border-crt-border/30 pb-2">
          THE COLLECTION
        </div>
        <div className="text-crt text-xs leading-relaxed">
          {config.collection.description}
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs mt-3">
          <div>
            <span className="text-crt-dim">ARTIST: </span>
            <span className="text-crt-bright">{config.collection.artist}</span>
          </div>
          <div>
            <span className="text-crt-dim">TOTAL SUPPLY: </span>
            <span className="text-crt">{config.collection.totalSupply.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-crt-dim">PARENTS: </span>
            <span className="text-crt">65 INSCRIPTIONS</span>
          </div>
          <div>
            <span className="text-crt-dim">TECHNIQUE: </span>
            <span className="text-crt">REVERSE PROVENANCE</span>
          </div>
        </div>
      </div>

      {/* Colors */}
      <div className="border border-crt-border p-4 space-y-3">
        <div className="text-crt-bright text-sm border-b border-crt-border/30 pb-2">
          22 COLORS + 1 MYSTERY
        </div>
        <div className="flex flex-wrap gap-1">
          {config.collection.colors.map((color, i) => (
            <span
              key={color}
              className={`text-[10px] px-1.5 py-0.5 border ${
                color.includes("Mystery")
                  ? "border-crt-bright text-crt-bright animate-pulse"
                  : "border-crt-border/50 text-crt-dim"
              }`}
            >
              {color.toUpperCase()}
            </span>
          ))}
        </div>
        {blockHeight && (
          <div className="text-crt-dim text-xs">
            MYSTERY COLOR HUE AT BLOCK {blockHeight.toLocaleString()}: {mysteryColorIndex}deg
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="border border-crt-border p-4 space-y-3">
        <div className="text-crt-bright text-sm border-b border-crt-border/30 pb-2">
          HOW THE MARKETPLACE WORKS
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex gap-2">
            <span className="text-crt-bright">1.</span>
            <span className="text-crt">
              CONNECT YOUR XVERSE OR UNISAT WALLET
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-crt-bright">2.</span>
            <span className="text-crt">
              LIST YOUR LAVA LAMP BY SIGNING A PSBT WITH SIGHASH_SINGLE|ANYONECANPAY — THIS CREATES A TRUSTLESS,
              NON-CUSTODIAL LISTING THAT ONLY TRANSFERS YOUR INSCRIPTION IF YOU RECEIVE YOUR ASKING PRICE
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-crt-bright">3.</span>
            <span className="text-crt">
              LISTINGS ARE PUBLISHED TO NOSTR RELAYS (NIP-78) — DECENTRALIZED AND CENSORSHIP-RESISTANT
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-crt-bright">4.</span>
            <span className="text-crt">
              BUYERS COMPLETE THE PSBT BY ADDING PAYMENT INPUTS AND SIGNING WITH SIGHASH_ALL — THE
              TRANSACTION IS THEN BROADCAST TO THE BITCOIN NETWORK
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-crt-bright">5.</span>
            <span className="text-crt">
              A {config.marketplace.feePercent}% MARKETPLACE FEE IS INCLUDED AS A SEPARATE OUTPUT IN THE TRANSACTION
            </span>
          </div>
        </div>
      </div>

      {/* Technical details */}
      <div className="border border-crt-border p-4 space-y-3">
        <div className="text-crt-bright text-sm border-b border-crt-border/30 pb-2">
          TECHNICAL DETAILS
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-crt-dim">TRADING PROTOCOL:</span>
            <span className="text-crt">PSBT (BIP-174)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-crt-dim">SELLER SIGHASH:</span>
            <span className="text-crt">SINGLE|ANYONECANPAY (0x83)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-crt-dim">BUYER SIGHASH:</span>
            <span className="text-crt">ALL (0x01)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-crt-dim">LISTING STORAGE:</span>
            <span className="text-crt">NOSTR (NIP-78, KIND 30078)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-crt-dim">INSCRIPTION SAFETY:</span>
            <span className="text-crt">FIFO SAT TRACKING VALIDATION</span>
          </div>
          <div className="flex justify-between">
            <span className="text-crt-dim">INDEXER:</span>
            <span className="text-crt">UNISAT OPEN API</span>
          </div>
          <div className="flex justify-between">
            <span className="text-crt-dim">FEE ESTIMATION:</span>
            <span className="text-crt">MEMPOOL.SPACE API</span>
          </div>
          <div className="flex justify-between">
            <span className="text-crt-dim">NOSTR IDENTITY:</span>
            <span className="text-crt">DERIVED FROM BTC WALLET SIG</span>
          </div>
        </div>
      </div>

      {/* Nostr relays */}
      <div className="border border-crt-border p-4 space-y-3">
        <div className="text-crt-bright text-sm border-b border-crt-border/30 pb-2">
          NOSTR RELAYS
        </div>
        <div className="space-y-1 text-xs">
          {config.nostr.relays.map((relay) => (
            <div key={relay} className="text-crt">
              &gt; {relay}
            </div>
          ))}
        </div>
      </div>

      {/* Grandparent inscription */}
      <div className="border border-crt-border/30 p-4 space-y-2 text-xs">
        <div className="text-crt-dim">
          GRANDPARENT INSCRIPTION: #152930 &quot;WORLD PEACE&quot;
        </div>
        <div className="text-crt-dim">
          65 PARENT INSCRIPTIONS | 1,950 GRANDCHILD (LAVA LAMP) INSCRIPTIONS
        </div>
        <div className="text-crt-dim">
          MARKETPLACE: {config.marketplace.name} | NETWORK: {config.marketplace.network.toUpperCase()}
        </div>
      </div>

      {/* Warning */}
      <div className="border border-crt-border/50 p-3 text-[10px] text-crt-dim text-center">
        THIS IS AN OPEN-SOURCE, NON-CUSTODIAL MARKETPLACE. ALL TRANSACTIONS ARE
        EXECUTED ON THE BITCOIN BLOCKCHAIN AND ARE IRREVERSIBLE. ALWAYS VERIFY
        TRANSACTION DETAILS IN YOUR WALLET BEFORE SIGNING. USE AT YOUR OWN RISK.
      </div>
    </div>
  );
}
