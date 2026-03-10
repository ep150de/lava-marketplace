"use client";

import React, { useState, useMemo } from "react";
import { Button, Loader } from "@/components/crt";
import TimelockForm from "@/components/marketplace/TimelockForm";
import TimelockCard from "@/components/marketplace/TimelockCard";
import UnlockModal from "@/components/marketplace/UnlockModal";
import { useTimelocks } from "@/hooks/useTimelocks";
import { useWallet } from "@/hooks/useWallet";
import { useMarketplaceContext } from "@/context/MarketplaceContext";
import { isLocktimeExpired } from "@/lib/psbt/timelock-script";
import { exportTimelocksBackup } from "@/lib/timelock/export";
import type { TimelockRecord } from "@/lib/nostr/timelock-schema";

type FilterMode = "all" | "locked" | "expired" | "unlocked";

export default function TrustFundPage() {
  const { connected, ordinalsAddress } = useWallet();
  const { blockHeight } = useMarketplaceContext();
  const { timelocks, loading, error, refetch } = useTimelocks();

  const [createFormOpen, setCreateFormOpen] = useState(false);
  const [unlockTarget, setUnlockTarget] = useState<TimelockRecord | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  // Categorize timelocks
  const categorized = useMemo(() => {
    let locked = 0;
    let expired = 0;
    let unlocked = 0;

    for (const t of timelocks) {
      if (t.status === "unlocked") {
        unlocked++;
      } else if (blockHeight && isLocktimeExpired(t.locktime, blockHeight)) {
        expired++;
      } else {
        locked++;
      }
    }

    return { locked, expired, unlocked, total: timelocks.length };
  }, [timelocks, blockHeight]);

  // Filtered timelocks
  const filteredTimelocks = useMemo(() => {
    if (filterMode === "all") return timelocks;

    return timelocks.filter((t) => {
      if (filterMode === "unlocked") return t.status === "unlocked";
      if (filterMode === "expired") {
        return t.status !== "unlocked" && blockHeight !== null && isLocktimeExpired(t.locktime, blockHeight);
      }
      if (filterMode === "locked") {
        return t.status !== "unlocked" && (blockHeight === null || !isLocktimeExpired(t.locktime, blockHeight));
      }
      return true;
    });
  }, [timelocks, filterMode, blockHeight]);

  const handleUnlockClick = (timelock: TimelockRecord) => {
    setUnlockTarget(timelock);
  };

  const handleUnlockComplete = () => {
    setUnlockTarget(null);
    refetch();
  };

  const handleCreateComplete = () => {
    setCreateFormOpen(false);
    refetch();
  };

  const handleExportBackup = () => {
    if (!ordinalsAddress || timelocks.length === 0) return;
    exportTimelocksBackup(ordinalsAddress, timelocks);
  };

  if (!connected) {
    return (
      <div className="space-y-4 font-mono text-center py-12">
        <pre className="text-crt-dim text-xs leading-tight inline-block text-left">
{`
  ┌─────────────────────────────────────┐
  │                                     │
  │   WALLET NOT CONNECTED              │
  │                                     │
  │   CONNECT YOUR WALLET TO CREATE     │
  │   AND MANAGE BITCOIN TIMELOCKS.     │
  │                                     │
  │   LOCK INSCRIPTIONS OR BTC SATS     │
  │   USING OP_CHECKLOCKTIMEVERIFY.     │
  │                                     │
  └─────────────────────────────────────┘
`}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="border-b border-crt-dim pb-2 font-mono">
        <div className="text-crt-bright text-sm">TRUST FUND</div>
        <div className="text-crt-dim text-xs mt-1">
          BITCOIN TIMELOCKS — LOCK INSCRIPTIONS OR SATS UNTIL A FUTURE DATE OR BLOCK HEIGHT
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between font-mono text-xs">
        <div className="flex items-center gap-3">
          <span className="text-crt-dim">
            TOTAL: <span className="text-crt">{categorized.total}</span>
          </span>
          {categorized.locked > 0 && (
            <span className="text-crt-dim">
              LOCKED: <span className="text-crt">{categorized.locked}</span>
            </span>
          )}
          {categorized.expired > 0 && (
            <span className="text-crt-dim">
              EXPIRED: <span className="text-green-500">{categorized.expired}</span>
            </span>
          )}
          {categorized.unlocked > 0 && (
            <span className="text-crt-dim">
              UNLOCKED: <span className="text-crt-dim">{categorized.unlocked}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refetch} disabled={loading}>
            {loading ? "SYNCING..." : "SYNC"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportBackup}
            disabled={timelocks.length === 0}
          >
            EXPORT BACKUP
          </Button>
          <Button variant="primary" size="sm" onClick={() => setCreateFormOpen(true)}>
            NEW TIMELOCK
          </Button>
        </div>
      </div>

      {categorized.total > 0 && (
        <div className="text-crt-dim text-[10px] font-mono">
          EXPORT BACKUP DOWNLOADS THE FULL TIMELOCK RECOVERY DATA NEEDED TO REBUILD AND UNLOCK YOUR TRUST FUND ENTRIES ON ANOTHER DEVICE.
        </div>
      )}

      {/* Filter tabs */}
      {categorized.total > 0 && (
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-crt-dim">FILTER:</span>
          {(["all", "locked", "expired", "unlocked"] as FilterMode[]).map((mode) => {
            const count =
              mode === "all"
                ? categorized.total
                : mode === "locked"
                ? categorized.locked
                : mode === "expired"
                ? categorized.expired
                : categorized.unlocked;

            return (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`px-2 py-0.5 cursor-pointer ${
                  filterMode === mode
                    ? "bg-crt text-crt-bg"
                    : "text-crt-dim hover:text-crt"
                }`}
              >
                {mode.toUpperCase()} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <Loader text="LOADING TIMELOCKS" variant="cursor" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border border-crt-error p-3 font-mono text-xs">
          <span className="text-crt-error">ERROR: {error}</span>
        </div>
      )}

      {/* Block height info */}
      {blockHeight && (
        <div className="text-crt-dim text-[10px] font-mono">
          CURRENT BLOCK HEIGHT: {blockHeight.toLocaleString()}
        </div>
      )}

      {/* Timelock cards */}
      {!loading && filteredTimelocks.length === 0 && categorized.total === 0 && (
        <div className="text-center py-12 font-mono space-y-3">
          <pre className="text-crt-dim text-xs leading-tight inline-block text-left">
{`
  ┌─────────────────────────────────────┐
  │                                     │
  │   NO TIMELOCKS FOUND                │
  │                                     │
  │   CREATE YOUR FIRST TIMELOCK TO     │
  │   LOCK INSCRIPTIONS OR BTC SATS     │
  │   UNTIL A FUTURE DATE.              │
  │                                     │
  │   IF YOU CREATED TIMELOCKS ON       │
  │   ANOTHER DEVICE, TAP SYNC.        │
  │                                     │
  └─────────────────────────────────────┘
`}
          </pre>
          <div className="flex items-center justify-center gap-2">
            <Button variant="primary" onClick={() => setCreateFormOpen(true)}>
              CREATE FIRST TIMELOCK
            </Button>
            <Button variant="ghost" onClick={refetch} disabled={loading}>
              SYNC FROM NOSTR
            </Button>
          </div>
        </div>
      )}

      {!loading && filteredTimelocks.length === 0 && categorized.total > 0 && (
        <div className="text-center py-8 font-mono">
          <div className="text-crt-dim text-sm">NO {filterMode.toUpperCase()} TIMELOCKS</div>
        </div>
      )}

      {!loading && filteredTimelocks.length > 0 && (
        <div className="space-y-3">
          {filteredTimelocks.map((timelock) => (
            <TimelockCard
              key={`${timelock.lockTxid}:${timelock.lockVout}`}
              timelock={timelock}
              currentBlockHeight={blockHeight}
              onUnlock={handleUnlockClick}
            />
          ))}
        </div>
      )}

      {/* Create Timelock modal */}
      <TimelockForm
        isOpen={createFormOpen}
        onClose={() => setCreateFormOpen(false)}
        onComplete={handleCreateComplete}
      />

      {/* Unlock modal */}
      {unlockTarget && (
        <UnlockModal
          timelock={unlockTarget}
          isOpen={!!unlockTarget}
          onClose={() => setUnlockTarget(null)}
          onComplete={handleUnlockComplete}
        />
      )}
    </div>
  );
}
