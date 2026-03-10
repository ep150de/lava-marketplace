"use client";

import React, { useEffect, useState } from "react";
import { Button, Input, Modal } from "@/components/crt";
import { useCreateListing, type CreateListingState } from "@/hooks/useCreateListing";
import { formatBtc, formatSats } from "@/utils/format";
import { calculateMarketplaceFee } from "@/lib/psbt";
import type { InscriptionData } from "@/lib/ordinals";
import type { MarketScope } from "@/lib/nostr";
import config from "../../../marketplace.config";

interface ListingFormProps {
  inscription: InscriptionData;
  marketScope?: MarketScope;
  initialPriceSats?: number;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function ListingForm({
  inscription,
  marketScope = "lava-lamps",
  initialPriceSats,
  isOpen,
  onClose,
  onComplete,
}: ListingFormProps) {
  const [priceInput, setPriceInput] = useState(
    initialPriceSats ? (initialPriceSats / 100_000_000).toFixed(8) : ""
  );
  const { step, error, eventId, createListing, reset } = useCreateListing();

  const priceSats = Math.floor(parseFloat(priceInput || "0") * 100_000_000);
  const marketplaceFee = calculateMarketplaceFee(priceSats);
  const sellerReceives = priceSats - marketplaceFee;

  const isValidPrice =
    priceSats >= config.marketplace.minListingPriceSats && !isNaN(priceSats);

  const handleSubmit = async () => {
    if (!isValidPrice) return;
    await createListing(inscription, priceSats, marketScope);
  };

  const marketLabel = marketScope === "lava-lamps" ? "VERIFIED LAVA" : "OPEN MARKET";

  useEffect(() => {
    setPriceInput(initialPriceSats ? (initialPriceSats / 100_000_000).toFixed(8) : "");
  }, [initialPriceSats, inscription.inscriptionId]);

  const handleClose = () => {
    reset();
    setPriceInput(initialPriceSats ? (initialPriceSats / 100_000_000).toFixed(8) : "");
    onClose();
    if (step === "complete") onComplete?.();
  };

  const stepMessages: Record<CreateListingState["step"], string> = {
    idle: "",
    "validating-collection": "> VERIFYING COLLECTION PROVENANCE...",
    "signing-nostr": "> SIGN MESSAGE TO DERIVE NOSTR IDENTITY...",
    "creating-psbt": "> CONSTRUCTING LISTING PSBT...",
    "signing-psbt": "> SIGN THE LISTING TRANSACTION IN YOUR WALLET...",
    publishing: "> PUBLISHING LISTING TO NOSTR RELAYS...",
    complete: "> LISTING PUBLISHED SUCCESSFULLY!",
    error: `> ERROR: ${error}`,
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="CREATE LISTING" width="md">
      <div className="space-y-4">
        {/* Inscription info */}
        <div className="border border-crt-dim p-3 space-y-1">
          <div className="text-crt-bright text-xs">INSCRIPTION</div>
          <div className="text-crt text-sm">
            {inscription.inscriptionId.slice(0, 16)}...
          </div>
          <div className="text-crt-dim text-xs">
            TYPE: {inscription.contentType} | VALUE:{" "}
            {inscription.outputValue} sats
          </div>
          <div className="text-crt-dim text-xs">MARKET: {marketLabel}</div>
        </div>

        {step === "idle" && (
          <>
            {/* Price input */}
            <Input
              label="LISTING PRICE"
              suffix="BTC"
              placeholder="0.00100000"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              type="number"
              step="0.00000001"
              min="0"
            />

            {/* Fee breakdown */}
            {priceSats > 0 && (
              <div className="border border-crt-border p-3 space-y-1 text-xs font-mono">
                <div className="text-crt-dim">FEE BREAKDOWN</div>
                <div className="border-t border-crt-border/30 my-1" />
                <div className="flex justify-between">
                  <span className="text-crt-dim">LISTING PRICE:</span>
                  <span className="text-crt">
                    {formatBtc(priceSats)} BTC ({formatSats(priceSats)} sats)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-crt-dim">
                    MARKETPLACE FEE ({config.marketplace.feePercent}%):
                  </span>
                  <span className="text-crt-error">
                    -{formatSats(marketplaceFee)} sats
                  </span>
                </div>
                <div className="border-t border-crt-border/30 my-1" />
                <div className="flex justify-between">
                  <span className="text-crt-bright">YOU RECEIVE:</span>
                  <span className="text-crt-bright text-glow">
                    {formatBtc(sellerReceives)} BTC
                  </span>
                </div>
              </div>
            )}

            {/* Min price warning */}
            {priceSats > 0 && !isValidPrice && (
              <div className="text-crt-error text-xs font-mono">
                ! MINIMUM LISTING PRICE:{" "}
                {formatSats(config.marketplace.minListingPriceSats)} sats
              </div>
            )}

            {/* Submit */}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose}>
                CANCEL
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={!isValidPrice}
              >
                LIST FOR SALE
              </Button>
            </div>
          </>
        )}

        {/* Progress */}
        {step !== "idle" && (
          <div className="space-y-2">
            <div
              className={`text-xs font-mono ${
                step === "error" ? "text-crt-error" : step === "complete" ? "text-green-500" : "text-crt"
              }`}
            >
              {stepMessages[step]}
              {step !== "complete" && step !== "error" && (
                <span className="terminal-cursor ml-1">&#9608;</span>
              )}
            </div>

            {step === "complete" && eventId && (
              <div className="text-crt-dim text-xs">
                EVENT ID: {eventId.slice(0, 16)}...
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
