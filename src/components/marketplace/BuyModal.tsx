"use client";

import React, { useState, useMemo } from "react";
import { Button, Modal } from "@/components/crt";
import { usePurchase } from "@/hooks/usePurchase";
import { useFeeRate } from "@/hooks/useFeeRate";
import { formatBtc, formatSats, truncateAddress } from "@/utils/format";
import { MIN_FEE_RATE } from "@/utils/constants";
import { estimatePurchaseFees, calculateMarketplaceFee } from "@/lib/psbt";
import type { ListingWithNostr } from "@/lib/nostr";
import config from "../../../marketplace.config";

type FeePreset = "economy" | "normal" | "fast" | "custom";

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
  const { feeRates } = useFeeRate();

  const [selectedPreset, setSelectedPreset] = useState<FeePreset>("economy");
  const [customFeeInput, setCustomFeeInput] = useState("");

  // Resolve the effective fee rate from the selected preset
  const effectiveFeeRate = useMemo(() => {
    if (selectedPreset === "custom") {
      const parsed = parseFloat(customFeeInput);
      return isNaN(parsed) ? null : parsed;
    }
    if (!feeRates) return null;
    switch (selectedPreset) {
      case "economy": return feeRates.economy;
      case "normal": return feeRates.hour;
      case "fast": return feeRates.halfHour;
      default: return feeRates.economy;
    }
  }, [selectedPreset, customFeeInput, feeRates]);

  // Validate custom fee input
  const feeError = useMemo(() => {
    if (selectedPreset !== "custom") return null;
    if (!customFeeInput) return null;
    const parsed = parseFloat(customFeeInput);
    if (isNaN(parsed)) return "Invalid number";
    if (parsed < MIN_FEE_RATE) return `Min ${MIN_FEE_RATE} sat/vB`;
    return null;
  }, [selectedPreset, customFeeInput]);

  // Estimate miner fee for display
  const estimatedMinerFee = useMemo(() => {
    if (!effectiveFeeRate || effectiveFeeRate < MIN_FEE_RATE) return null;
    const estimate = estimatePurchaseFees(listing.priceSats, effectiveFeeRate, 1, "taproot");
    return estimate.minerFeeSats;
  }, [effectiveFeeRate, listing.priceSats]);

  const marketplaceFeeSats = calculateMarketplaceFee(listing.priceSats);

  const canBuy = effectiveFeeRate !== null && effectiveFeeRate >= MIN_FEE_RATE && !feeError;

  const handleBuy = async () => {
    if (!canBuy || !effectiveFeeRate) return;
    await purchase(listing, effectiveFeeRate);
  };

  const handleClose = () => {
    reset();
    setSelectedPreset("economy");
    setCustomFeeInput("");
    onClose();
    if (step === "complete") onComplete?.();
  };

  const presetButtons: { key: FeePreset; label: string; rate: number | null }[] = [
    { key: "economy", label: "ECONOMY", rate: feeRates?.economy ?? null },
    { key: "normal", label: "NORMAL", rate: feeRates?.hour ?? null },
    { key: "fast", label: "FAST", rate: feeRates?.halfHour ?? null },
    { key: "custom", label: "CUSTOM", rate: null },
  ];

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
            {/* Fee rate picker */}
            <div className="border border-crt-border p-3 space-y-2 text-xs font-mono">
              <div className="text-crt-dim">FEE RATE (sat/vB)</div>
              <div className="flex flex-wrap gap-1.5">
                {presetButtons.map(({ key, label, rate }) => (
                  <button
                    key={key}
                    onClick={() => setSelectedPreset(key)}
                    className={`px-2 py-1 border font-mono text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                      selectedPreset === key
                        ? "border-crt text-crt bg-crt/10 text-glow"
                        : "border-crt-border text-crt-dim hover:border-crt-dim hover:text-crt"
                    }`}
                  >
                    {label}
                    {rate !== null && (
                      <span className="ml-1 opacity-70">{rate}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Custom fee input */}
              {selectedPreset === "custom" && (
                <div className="flex items-center border border-crt-dim focus-within:border-crt bg-transparent mt-1">
                  <span className="text-crt-dim pl-2 font-mono text-sm">&gt;</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={customFeeInput}
                    onChange={(e) => setCustomFeeInput(e.target.value)}
                    placeholder={`min ${MIN_FEE_RATE}`}
                    className="flex-1 bg-transparent text-crt font-mono text-sm px-2 py-1.5 outline-none placeholder:text-crt-border"
                  />
                  <span className="text-crt-dim pr-2 font-mono text-[10px] uppercase">
                    sat/vB
                  </span>
                </div>
              )}

              {feeError && (
                <p className="text-crt-error text-[10px] font-mono">! {feeError}</p>
              )}

              {/* Show effective rate for presets */}
              {selectedPreset !== "custom" && effectiveFeeRate && (
                <div className="text-crt-dim text-[10px]">
                  SELECTED: {effectiveFeeRate} sat/vB
                </div>
              )}
            </div>

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
                  {formatSats(marketplaceFeeSats)} sats
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-crt-dim">NETWORK FEE:</span>
                <span className="text-crt-dim">
                  {estimatedMinerFee !== null
                    ? `~${formatSats(estimatedMinerFee)} sats`
                    : "---"}
                </span>
              </div>
              <div className="border-t border-crt-border/30 my-1" />
              <div className="flex justify-between">
                <span className="text-crt-bright">TOTAL COST:</span>
                <span className="text-crt-bright text-glow">
                  {estimatedMinerFee !== null
                    ? `~${formatBtc(listing.priceSats + marketplaceFeeSats + estimatedMinerFee)} BTC`
                    : `~${formatBtc(listing.priceSats + marketplaceFeeSats)} BTC + fees`}
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
              <Button variant="primary" onClick={handleBuy} disabled={!canBuy}>
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
