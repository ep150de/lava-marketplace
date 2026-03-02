"use client";

import React from "react";
import { Button, Modal } from "@/components/crt";
import { usePurchase } from "@/hooks/usePurchase";
import { formatBtc, formatSats, truncateAddress } from "@/utils/format";
import type { ListingWithNostr } from "@/lib/nostr";
import config from "../../../marketplace.config";

interface BuyModalProps {
  listing: ListingWithNostr;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function BuyModal({
  listing,
  isOpen,
  onClose,
  onComplete,
}: BuyModalProps) {
  const { step, error, txid, fees, purchase, reset } = usePurchase();

  const handleBuy = async () => {
    await purchase(listing);
  };

  const handleClose = () => {
    reset();
    onClose();
    if (step === "complete") onComplete?.();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="CONFIRM PURCHASE" width="md">
      <div className="space-y-4">
        {/* Inscription info */}
        <div className="border border-crt-dim p-3 space-y-1 text-xs font-mono">
          <div className="text-crt-bright">INSCRIPTION</div>
          <div className="text-crt">{listing.inscriptionId.slice(0, 24)}...</div>
          <div className="text-crt-dim">
            SELLER: {truncateAddress(listing.sellerAddress, 8)}
          </div>
        </div>

        {step === "idle" && (
          <>
            {/* Transaction breakdown */}
            <div className="border border-crt-border p-3 space-y-1 text-xs font-mono">
              <div className="text-crt-dim">TRANSACTION BREAKDOWN</div>
              <div className="border-t border-crt-border/30 my-1" />
              <div className="flex justify-between">
                <span className="text-crt-dim">INSCRIPTION PRICE:</span>
                <span className="text-crt">
                  {formatBtc(listing.priceSats)} BTC
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-crt-dim">
                  MARKETPLACE FEE ({config.marketplace.feePercent}%):
                </span>
                <span className="text-crt-dim">
                  ~{formatSats(
                    Math.floor(
                      listing.priceSats * (config.marketplace.feePercent / 100)
                    )
                  )}{" "}
                  sats
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-crt-dim">NETWORK FEE:</span>
                <span className="text-crt-dim">~estimated at signing</span>
              </div>
              <div className="border-t border-crt-border/30 my-1" />
              <div className="flex justify-between">
                <span className="text-crt-bright">TOTAL COST:</span>
                <span className="text-crt-bright text-glow">
                  ~{formatBtc(
                    listing.priceSats +
                      Math.floor(
                        listing.priceSats * (config.marketplace.feePercent / 100)
                      )
                  )}{" "}
                  BTC + fees
                </span>
              </div>
            </div>

            {/* Warning */}
            <div className="border border-crt-border/50 p-2 text-[10px] text-crt-dim font-mono">
              WARNING: VERIFY ALL TRANSACTION DETAILS IN YOUR WALLET BEFORE
              SIGNING. THIS ACTION IS IRREVERSIBLE ONCE BROADCAST.
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose}>
                CANCEL
              </Button>
              <Button variant="primary" onClick={handleBuy}>
                CONFIRM PURCHASE
              </Button>
            </div>
          </>
        )}

        {/* Progress */}
        {step !== "idle" && (
          <div className="space-y-3">
            <div className="space-y-1 text-xs font-mono">
              <div className={step === "preparing" ? "text-crt" : "text-crt-dim"}>
                {step === "preparing" ? "> " : "  "}PREPARING TRANSACTION...
                {step !== "preparing" && " OK"}
                {step === "preparing" && (
                  <span className="terminal-cursor ml-1">&#9608;</span>
                )}
              </div>
              {(step === "signing" || step === "broadcasting" || step === "complete") && (
                <div className={step === "signing" ? "text-crt" : "text-crt-dim"}>
                  {step === "signing" ? "> " : "  "}SIGN IN WALLET...
                  {step !== "signing" && " OK"}
                  {step === "signing" && (
                    <span className="terminal-cursor ml-1">&#9608;</span>
                  )}
                </div>
              )}
              {(step === "broadcasting" || step === "complete") && (
                <div className={step === "broadcasting" ? "text-crt" : "text-crt-dim"}>
                  {step === "broadcasting" ? "> " : "  "}BROADCASTING...
                  {step === "complete" && " OK"}
                  {step === "broadcasting" && (
                    <span className="terminal-cursor ml-1">&#9608;</span>
                  )}
                </div>
              )}
            </div>

            {/* Fee display */}
            {fees && (
              <div className="border border-crt-border p-2 text-xs font-mono space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-crt-dim">PRICE:</span>
                  <span className="text-crt">{formatSats(fees.priceSats)} sats</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-crt-dim">MARKETPLACE FEE:</span>
                  <span className="text-crt">{formatSats(fees.marketplaceFeeSats)} sats</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-crt-dim">MINER FEE:</span>
                  <span className="text-crt">{formatSats(fees.minerFeeSats)} sats</span>
                </div>
                <div className="border-t border-crt-border/30 my-0.5" />
                <div className="flex justify-between">
                  <span className="text-crt-bright">TOTAL:</span>
                  <span className="text-crt-bright text-glow">{formatSats(fees.totalSats)} sats</span>
                </div>
              </div>
            )}

            {/* Complete */}
            {step === "complete" && txid && (
              <div className="space-y-2">
                <div className="text-green-500 text-xs font-mono">
                  &gt; PURCHASE COMPLETE!
                </div>
                <div className="text-crt-dim text-xs font-mono">
                  TXID: {txid.slice(0, 16)}...
                </div>
                <a
                  href={`https://mempool.space/tx/${txid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-crt-bright text-xs font-mono"
                >
                  [VIEW ON MEMPOOL.SPACE]
                </a>
              </div>
            )}

            {/* Error */}
            {step === "error" && (
              <div className="text-crt-error text-xs font-mono">
                &gt; ERROR: {error}
              </div>
            )}

            {(step === "complete" || step === "error") && (
              <div className="flex justify-end">
                <Button variant="primary" onClick={handleClose}>
                  {step === "complete" ? "DONE" : "CLOSE"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
