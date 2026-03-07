"use client";

import React, { useState, useMemo } from "react";
import { Button, Input, Modal } from "@/components/crt";
import { useCreateTimelock, type CreateTimelockState } from "@/hooks/useCreateTimelock";
import { useInscriptions } from "@/hooks/useInscriptions";
import { useFeeRate } from "@/hooks/useFeeRate";
import { useMarketplaceContext } from "@/context/MarketplaceContext";
import { formatBtc, formatSats, truncateInscriptionId } from "@/utils/format";
import { locktimeFromDate, isBlockHeightLocktime, formatLocktime } from "@/lib/psbt/timelock-script";
import { MIN_FEE_RATE, TIMELOCK_MIN_OUTPUT_VALUE, TIMELOCK_THRESHOLD } from "@/utils/constants";
import type { InscriptionData } from "@/lib/ordinals";

type LockMode = "inscription" | "sats";
type LocktimeMode = "date" | "block";
type FeePreset = "economy" | "normal" | "fast" | "custom";

interface TimelockFormProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function TimelockForm({
  isOpen,
  onClose,
  onComplete,
}: TimelockFormProps) {
  // Lock mode (inscription vs sats)
  const [lockMode, setLockMode] = useState<LockMode>("inscription");

  // Locktime input
  const [locktimeMode, setLocktimeMode] = useState<LocktimeMode>("date");
  const [dateInput, setDateInput] = useState("");
  const [blockHeightInput, setBlockHeightInput] = useState("");

  // Inscription selection
  const [selectedInscription, setSelectedInscription] = useState<InscriptionData | null>(null);

  // Sats amount
  const [satsInput, setSatsInput] = useState("");

  // Label
  const [labelInput, setLabelInput] = useState("");

  // Fee rate
  const [selectedPreset, setSelectedPreset] = useState<FeePreset>("economy");
  const [customFeeInput, setCustomFeeInput] = useState("");

  // Hooks
  const { step, error, txid, timelockAddress, createTimelock, reset } = useCreateTimelock();
  const { inscriptions, loading: inscLoading } = useInscriptions();
  const { feeRates } = useFeeRate();
  const { blockHeight } = useMarketplaceContext();

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

  // Compute locktime value
  const computedLocktime = useMemo(() => {
    if (locktimeMode === "date") {
      if (!dateInput) return null;
      try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return null;
        // Must be in the future
        if (date.getTime() <= Date.now()) return null;
        return locktimeFromDate(date);
      } catch {
        return null;
      }
    } else {
      const height = parseInt(blockHeightInput, 10);
      if (isNaN(height) || height <= 0) return null;
      if (height >= TIMELOCK_THRESHOLD) return null; // Block height must be < 500M
      // Must be in the future
      if (blockHeight && height <= blockHeight) return null;
      return height;
    }
  }, [locktimeMode, dateInput, blockHeightInput, blockHeight]);

  // Locktime validation error message
  const locktimeError = useMemo(() => {
    if (locktimeMode === "date") {
      if (!dateInput) return null;
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) return "Invalid date";
      if (date.getTime() <= Date.now()) return "Date must be in the future";
      return null;
    } else {
      if (!blockHeightInput) return null;
      const height = parseInt(blockHeightInput, 10);
      if (isNaN(height) || height <= 0) return "Invalid block height";
      if (height >= TIMELOCK_THRESHOLD) return "Block height must be < 500,000,000";
      if (blockHeight && height <= blockHeight) return `Must be > current height (${blockHeight.toLocaleString()})`;
      return null;
    }
  }, [locktimeMode, dateInput, blockHeightInput, blockHeight]);

  // Sats validation
  const satsAmount = parseInt(satsInput, 10) || 0;
  const satsError = useMemo(() => {
    if (lockMode !== "sats" || !satsInput) return null;
    if (isNaN(satsAmount) || satsAmount <= 0) return "Invalid amount";
    if (satsAmount < TIMELOCK_MIN_OUTPUT_VALUE) return `Minimum ${TIMELOCK_MIN_OUTPUT_VALUE} sats`;
    return null;
  }, [lockMode, satsInput, satsAmount]);

  // Can submit?
  const canSubmit = useMemo(() => {
    if (!computedLocktime) return false;
    if (!effectiveFeeRate || effectiveFeeRate < MIN_FEE_RATE || feeError) return false;
    if (lockMode === "inscription" && !selectedInscription) return false;
    if (lockMode === "sats" && (satsAmount < TIMELOCK_MIN_OUTPUT_VALUE || satsError)) return false;
    return true;
  }, [computedLocktime, effectiveFeeRate, feeError, lockMode, selectedInscription, satsAmount, satsError]);

  const handleSubmit = async () => {
    if (!canSubmit || !computedLocktime || !effectiveFeeRate) return;
    await createTimelock({
      mode: lockMode,
      locktime: computedLocktime,
      feeRateSatVb: effectiveFeeRate,
      inscription: lockMode === "inscription" ? selectedInscription ?? undefined : undefined,
      lockAmountSats: lockMode === "sats" ? satsAmount : undefined,
      label: labelInput.trim() || undefined,
    });
  };

  const handleClose = () => {
    reset();
    setLockMode("inscription");
    setLocktimeMode("date");
    setDateInput("");
    setBlockHeightInput("");
    setSelectedInscription(null);
    setSatsInput("");
    setLabelInput("");
    setSelectedPreset("economy");
    setCustomFeeInput("");
    onClose();
    if (step === "complete") onComplete?.();
  };

  // Minimum date for date picker (tomorrow)
  const minDate = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  }, []);

  const presetButtons: { key: FeePreset; label: string; rate: number | null }[] = [
    { key: "economy", label: "ECONOMY", rate: feeRates?.economy ?? null },
    { key: "normal", label: "NORMAL", rate: feeRates?.hour ?? null },
    { key: "fast", label: "FAST", rate: feeRates?.halfHour ?? null },
    { key: "custom", label: "CUSTOM", rate: null },
  ];

  const stepMessages: Record<CreateTimelockState["step"], string> = {
    idle: "",
    "building-psbt": "> CONSTRUCTING TIMELOCK PSBT...",
    "signing-psbt": "> SIGN THE LOCK TRANSACTION IN YOUR WALLET...",
    broadcasting: "> BROADCASTING LOCK TRANSACTION...",
    "signing-nostr": "> SIGN MESSAGE TO DERIVE NOSTR IDENTITY...",
    publishing: "> PUBLISHING ENCRYPTED METADATA TO NOSTR...",
    complete: "> TIMELOCK CREATED SUCCESSFULLY!",
    error: `> ERROR: ${error}`,
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="CREATE TIMELOCK" width="lg">
      <div className="space-y-4">
        {step === "idle" && (
          <>
            {/* Lock mode tabs */}
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-crt-dim">LOCK:</span>
              <button
                onClick={() => { setLockMode("inscription"); setSelectedInscription(null); }}
                className={`px-2 py-0.5 cursor-pointer ${
                  lockMode === "inscription"
                    ? "bg-crt text-crt-bg"
                    : "text-crt-dim hover:text-crt"
                }`}
              >
                INSCRIPTION
              </button>
              <button
                onClick={() => { setLockMode("sats"); setSelectedInscription(null); }}
                className={`px-2 py-0.5 cursor-pointer ${
                  lockMode === "sats"
                    ? "bg-crt text-crt-bg"
                    : "text-crt-dim hover:text-crt"
                }`}
              >
                BTC SATS
              </button>
            </div>

            {/* Inscription selector */}
            {lockMode === "inscription" && (
              <div className="border border-crt-border p-3 space-y-2">
                <div className="text-crt-dim text-xs font-mono">SELECT INSCRIPTION TO LOCK</div>
                {inscLoading ? (
                  <div className="text-crt-dim text-xs font-mono">LOADING INSCRIPTIONS...</div>
                ) : inscriptions.length === 0 ? (
                  <div className="text-crt-dim text-xs font-mono">NO INSCRIPTIONS FOUND IN WALLET</div>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {inscriptions.map((insc) => (
                      <button
                        key={insc.inscriptionId}
                        onClick={() => setSelectedInscription(insc)}
                        className={`w-full text-left px-2 py-1 text-xs font-mono border cursor-pointer transition-all ${
                          selectedInscription?.inscriptionId === insc.inscriptionId
                            ? "border-crt text-crt bg-crt/10 text-glow"
                            : "border-crt-border/30 text-crt-dim hover:border-crt-dim hover:text-crt"
                        }`}
                      >
                        <span className="text-crt-bright">#{insc.inscriptionNumber}</span>
                        <span className="ml-2">{truncateInscriptionId(insc.inscriptionId)}</span>
                        <span className="ml-2 text-crt-dim">{insc.outputValue} sats</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedInscription && (
                  <div className="border-t border-crt-border/30 pt-2 text-xs font-mono text-crt-dim">
                    SELECTED: #{selectedInscription.inscriptionNumber} |{" "}
                    VALUE: {selectedInscription.outputValue} sats |{" "}
                    TYPE: {selectedInscription.contentType}
                  </div>
                )}
              </div>
            )}

            {/* Sats amount input */}
            {lockMode === "sats" && (
              <Input
                label="AMOUNT TO LOCK"
                suffix="SATS"
                placeholder={`min ${TIMELOCK_MIN_OUTPUT_VALUE}`}
                value={satsInput}
                onChange={(e) => setSatsInput(e.target.value)}
                type="number"
                min={TIMELOCK_MIN_OUTPUT_VALUE}
                step="1"
                error={satsError ?? undefined}
              />
            )}

            {/* Locktime mode toggle + input */}
            <div className="border border-crt-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-crt-dim text-xs font-mono">UNLOCK DATE / BLOCK HEIGHT</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setLocktimeMode("date")}
                    className={`px-2 py-0.5 text-[10px] font-mono cursor-pointer ${
                      locktimeMode === "date"
                        ? "bg-crt text-crt-bg"
                        : "text-crt-dim hover:text-crt"
                    }`}
                  >
                    DATE
                  </button>
                  <button
                    onClick={() => setLocktimeMode("block")}
                    className={`px-2 py-0.5 text-[10px] font-mono cursor-pointer ${
                      locktimeMode === "block"
                        ? "bg-crt text-crt-bg"
                        : "text-crt-dim hover:text-crt"
                    }`}
                  >
                    BLOCK
                  </button>
                </div>
              </div>

              {locktimeMode === "date" ? (
                <div className="flex items-center border border-crt-dim focus-within:border-crt bg-transparent">
                  <span className="text-crt-dim pl-2 font-mono text-sm">&gt;</span>
                  <input
                    type="datetime-local"
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                    min={minDate}
                    className="flex-1 bg-transparent text-crt font-mono text-sm px-2 py-1.5 outline-none [color-scheme:dark]"
                  />
                </div>
              ) : (
                <div>
                  <div className="flex items-center border border-crt-dim focus-within:border-crt bg-transparent">
                    <span className="text-crt-dim pl-2 font-mono text-sm">&gt;</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={blockHeightInput}
                      onChange={(e) => setBlockHeightInput(e.target.value)}
                      placeholder={blockHeight ? `current: ${blockHeight.toLocaleString()}` : "block height"}
                      className="flex-1 bg-transparent text-crt font-mono text-sm px-2 py-1.5 outline-none placeholder:text-crt-border"
                    />
                    <span className="text-crt-dim pr-2 font-mono text-[10px] uppercase">BLOCK</span>
                  </div>
                  {blockHeight && (
                    <div className="text-crt-dim text-[10px] font-mono mt-1">
                      CURRENT HEIGHT: {blockHeight.toLocaleString()}
                    </div>
                  )}
                </div>
              )}

              {locktimeError && (
                <p className="text-crt-error text-[10px] font-mono">! {locktimeError}</p>
              )}

              {computedLocktime && !locktimeError && (
                <div className="text-crt-dim text-[10px] font-mono">
                  LOCKS UNTIL: {formatLocktime(computedLocktime)}
                  {isBlockHeightLocktime(computedLocktime)
                    ? ` (~${estimateBlocksToTime(computedLocktime - (blockHeight ?? 0))})`
                    : ""}
                </div>
              )}
            </div>

            {/* Label (optional) */}
            <Input
              label="LABEL (OPTIONAL)"
              placeholder="e.g. HODL until halving"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              maxLength={100}
            />

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

            {/* Summary */}
            {canSubmit && computedLocktime && (
              <div className="border border-crt-border p-3 space-y-1 text-xs font-mono">
                <div className="text-crt-dim">LOCK SUMMARY</div>
                <div className="border-t border-crt-border/30 my-1" />
                <div className="flex justify-between">
                  <span className="text-crt-dim">MODE:</span>
                  <span className="text-crt">{lockMode.toUpperCase()}</span>
                </div>
                {lockMode === "inscription" && selectedInscription && (
                  <div className="flex justify-between">
                    <span className="text-crt-dim">INSCRIPTION:</span>
                    <span className="text-crt">#{selectedInscription.inscriptionNumber}</span>
                  </div>
                )}
                {lockMode === "sats" && (
                  <div className="flex justify-between">
                    <span className="text-crt-dim">AMOUNT:</span>
                    <span className="text-crt">{formatSats(satsAmount)} sats ({formatBtc(satsAmount)} BTC)</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-crt-dim">LOCKED UNTIL:</span>
                  <span className="text-crt-bright text-glow">{formatLocktime(computedLocktime)}</span>
                </div>
                {labelInput.trim() && (
                  <div className="flex justify-between">
                    <span className="text-crt-dim">LABEL:</span>
                    <span className="text-crt">{labelInput.trim()}</span>
                  </div>
                )}
              </div>
            )}

            {/* Warning */}
            <div className="border border-crt-border/50 p-2 text-[10px] text-crt-dim font-mono">
              WARNING: ONCE LOCKED, FUNDS CANNOT BE SPENT UNTIL THE TIMELOCK
              EXPIRES. THIS IS ENFORCED BY THE BITCOIN PROTOCOL AND IS
              IRREVERSIBLE. VERIFY ALL DETAILS BEFORE SIGNING.
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose}>
                CANCEL
              </Button>
              <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit}>
                LOCK FUNDS
              </Button>
            </div>
          </>
        )}

        {/* Progress steps */}
        {step !== "idle" && (
          <div className="space-y-3">
            <div className="space-y-1 text-xs font-mono">
              {renderStepLine("building-psbt", "CONSTRUCTING TIMELOCK PSBT", step)}
              {(step === "signing-psbt" || isStepAfter(step, "signing-psbt")) &&
                renderStepLine("signing-psbt", "SIGN LOCK TRANSACTION IN WALLET", step)}
              {(step === "broadcasting" || isStepAfter(step, "broadcasting")) &&
                renderStepLine("broadcasting", "BROADCASTING LOCK TRANSACTION", step)}
              {(step === "signing-nostr" || isStepAfter(step, "signing-nostr")) &&
                renderStepLine("signing-nostr", "SIGN NOSTR KEY DERIVATION", step)}
              {(step === "publishing" || isStepAfter(step, "publishing")) &&
                renderStepLine("publishing", "PUBLISHING ENCRYPTED METADATA", step)}
            </div>

            {step === "complete" && (
              <div className="space-y-2">
                <div className="text-green-500 text-xs font-mono">
                  &gt; TIMELOCK CREATED SUCCESSFULLY!
                </div>
                {txid && (
                  <div className="text-crt-dim text-xs font-mono">
                    TXID: {txid.slice(0, 16)}...
                  </div>
                )}
                {timelockAddress && (
                  <div className="text-crt-dim text-xs font-mono">
                    LOCK ADDRESS: {timelockAddress.slice(0, 20)}...
                  </div>
                )}
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

// Helper: step ordering for progress display
const STEP_ORDER: CreateTimelockState["step"][] = [
  "idle",
  "building-psbt",
  "signing-psbt",
  "broadcasting",
  "signing-nostr",
  "publishing",
  "complete",
  "error",
];

function isStepAfter(
  currentStep: CreateTimelockState["step"],
  targetStep: CreateTimelockState["step"]
): boolean {
  const currentIdx = STEP_ORDER.indexOf(currentStep);
  const targetIdx = STEP_ORDER.indexOf(targetStep);
  return currentIdx > targetIdx;
}

function renderStepLine(
  targetStep: CreateTimelockState["step"],
  label: string,
  currentStep: CreateTimelockState["step"]
) {
  const isActive = currentStep === targetStep;
  const isDone = isStepAfter(currentStep, targetStep);

  return (
    <div className={isActive ? "text-crt" : "text-crt-dim"}>
      {isActive ? "> " : "  "}{label}...
      {isDone && " OK"}
      {isActive && <span className="terminal-cursor ml-1">&#9608;</span>}
    </div>
  );
}

// Helper: rough estimate blocks to human-readable time
function estimateBlocksToTime(blocks: number): string {
  if (blocks <= 0) return "now";
  const minutes = blocks * 10;
  if (minutes < 60) return `~${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `~${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `~${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `~${months}mo`;
  const years = Math.floor(days / 365);
  return `~${years}y`;
}
