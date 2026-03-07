"use client";

import React, { useState, useMemo } from "react";
import { Button, Modal } from "@/components/crt";
import { useUnlockTimelock, type UnlockTimelockState } from "@/hooks/useUnlockTimelock";
import { useFeeRate } from "@/hooks/useFeeRate";
import { useMarketplaceContext } from "@/context/MarketplaceContext";
import { formatSats, formatBtc, truncateInscriptionId } from "@/utils/format";
import { formatLocktime } from "@/lib/psbt/timelock-script";
import { MIN_FEE_RATE } from "@/utils/constants";
import type { TimelockRecord } from "@/lib/nostr/timelock-schema";

type FeePreset = "economy" | "normal" | "fast" | "custom";

interface UnlockModalProps {
  timelock: TimelockRecord;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function UnlockModal({
  timelock,
  isOpen,
  onClose,
  onComplete,
}: UnlockModalProps) {
  const { step, error, txid, unlockTimelock, reset } = useUnlockTimelock();
  const { feeRates } = useFeeRate();
  const { blockHeight } = useMarketplaceContext();

  const [selectedPreset, setSelectedPreset] = useState<FeePreset>("economy");
  const [customFeeInput, setCustomFeeInput] = useState("");

  // Compute effective fee rate
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

  // Validate custom fee
  const feeError = useMemo(() => {
    if (selectedPreset !== "custom") return null;
    if (!customFeeInput) return null;
    const parsed = parseFloat(customFeeInput);
    if (isNaN(parsed)) return "Invalid number";
    if (parsed < MIN_FEE_RATE) return `Min ${MIN_FEE_RATE} sat/vB`;
    return null;
  }, [selectedPreset, customFeeInput]);

  const canUnlock = effectiveFeeRate !== null && effectiveFeeRate >= MIN_FEE_RATE && !feeError && blockHeight !== null;

  const handleUnlock = async () => {
    if (!canUnlock || !effectiveFeeRate || blockHeight === null) return;
    await unlockTimelock(timelock, blockHeight, effectiveFeeRate);
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
    <Modal isOpen={isOpen} onClose={handleClose} title="UNLOCK TIMELOCK" width="md">
      <div className="space-y-4">
        {/* Timelock info */}
        <div className="border border-crt-dim p-3 space-y-1 text-xs font-mono">
          <div className="text-crt-bright">TIMELOCK DETAILS</div>
          <div className="border-t border-crt-border/30 my-1" />
          <div className="flex justify-between">
            <span className="text-crt-dim">MODE:</span>
            <span className="text-crt">{timelock.mode.toUpperCase()}</span>
          </div>
          {timelock.mode === "inscription" && timelock.inscriptionId && (
            <div className="flex justify-between">
              <span className="text-crt-dim">INSCRIPTION:</span>
              <span className="text-crt">
                {timelock.inscriptionNumber ? `#${timelock.inscriptionNumber} ` : ""}
                {truncateInscriptionId(timelock.inscriptionId)}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-crt-dim">LOCKED VALUE:</span>
            <span className="text-crt">
              {formatSats(timelock.lockedValueSats)} sats ({formatBtc(timelock.lockedValueSats)} BTC)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-crt-dim">LOCK EXPIRED:</span>
            <span className="text-green-500">{formatLocktime(timelock.locktime)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-crt-dim">DESTINATION:</span>
            <span className="text-crt">
              {timelock.mode === "inscription" ? "ORDINALS ADDRESS" : "PAYMENT ADDRESS"}
            </span>
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
                    {rate !== null && <span className="ml-1 opacity-70">{rate}</span>}
                  </button>
                ))}
              </div>

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
                  <span className="text-crt-dim pr-2 font-mono text-[10px] uppercase">sat/vB</span>
                </div>
              )}

              {feeError && (
                <p className="text-crt-error text-[10px] font-mono">! {feeError}</p>
              )}

              {selectedPreset !== "custom" && effectiveFeeRate && (
                <div className="text-crt-dim text-[10px]">
                  SELECTED: {effectiveFeeRate} sat/vB
                </div>
              )}
            </div>

            {/* Warning */}
            <div className="border border-crt-border/50 p-2 text-[10px] text-crt-dim font-mono">
              THIS WILL SPEND THE TIMELOCKED UTXO BACK TO YOUR{" "}
              {timelock.mode === "inscription" ? "ORDINALS" : "PAYMENT"} ADDRESS.
              VERIFY ALL DETAILS IN YOUR WALLET BEFORE SIGNING.
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose}>
                CANCEL
              </Button>
              <Button variant="primary" onClick={handleUnlock} disabled={!canUnlock}>
                UNLOCK FUNDS
              </Button>
            </div>
          </>
        )}

        {/* Progress */}
        {step !== "idle" && (
          <div className="space-y-3">
            <div className="space-y-1 text-xs font-mono">
              {renderStepLine("building-psbt", "CONSTRUCTING UNLOCK PSBT", step)}
              {(step === "signing-psbt" || isAfter(step, "signing-psbt")) &&
                renderStepLine("signing-psbt", "SIGN UNLOCK TRANSACTION IN WALLET", step)}
              {(step === "finalizing" || isAfter(step, "finalizing")) &&
                renderStepLine("finalizing", "FINALIZING TAPSCRIPT WITNESS", step)}
              {(step === "broadcasting" || isAfter(step, "broadcasting")) &&
                renderStepLine("broadcasting", "BROADCASTING UNLOCK TRANSACTION", step)}
              {(step === "updating-nostr" || isAfter(step, "updating-nostr")) &&
                renderStepLine("updating-nostr", "UPDATING NOSTR METADATA", step)}
            </div>

            {step === "complete" && txid && (
              <div className="space-y-2">
                <div className="text-green-500 text-xs font-mono">
                  &gt; TIMELOCK UNLOCKED SUCCESSFULLY!
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

// Step ordering for progress display
const STEP_ORDER: UnlockTimelockState["step"][] = [
  "idle",
  "building-psbt",
  "signing-psbt",
  "finalizing",
  "broadcasting",
  "updating-nostr",
  "complete",
  "error",
];

function isAfter(
  currentStep: UnlockTimelockState["step"],
  targetStep: UnlockTimelockState["step"]
): boolean {
  return STEP_ORDER.indexOf(currentStep) > STEP_ORDER.indexOf(targetStep);
}

function renderStepLine(
  targetStep: UnlockTimelockState["step"],
  label: string,
  currentStep: UnlockTimelockState["step"]
) {
  const isActive = currentStep === targetStep;
  const isDone = isAfter(currentStep, targetStep);

  return (
    <div className={isActive ? "text-crt" : "text-crt-dim"}>
      {isActive ? "> " : "  "}{label}...
      {isDone && " OK"}
      {isActive && <span className="terminal-cursor ml-1">&#9608;</span>}
    </div>
  );
}
