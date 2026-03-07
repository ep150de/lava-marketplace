"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/crt";
import { formatSats, formatBtc, truncateInscriptionId } from "@/utils/format";
import {
  formatLocktime,
  isLocktimeExpired,
  isBlockHeightLocktime,
} from "@/lib/psbt/timelock-script";
import type { TimelockRecord } from "@/lib/nostr/timelock-schema";

interface TimelockCardProps {
  timelock: TimelockRecord;
  currentBlockHeight: number | null;
  onUnlock: (timelock: TimelockRecord) => void;
}

type TimelockStatus = "LOCKED" | "EXPIRED" | "UNLOCKED";

export default function TimelockCard({
  timelock,
  currentBlockHeight,
  onUnlock,
}: TimelockCardProps) {
  const [countdown, setCountdown] = useState("");

  // Determine status
  const status: TimelockStatus = useMemo(() => {
    if (timelock.status === "unlocked") return "UNLOCKED";
    if (currentBlockHeight && isLocktimeExpired(timelock.locktime, currentBlockHeight)) {
      return "EXPIRED";
    }
    return "LOCKED";
  }, [timelock.status, timelock.locktime, currentBlockHeight]);

  // Countdown timer (only for timestamp-based locks that are still locked)
  useEffect(() => {
    if (status !== "LOCKED" || isBlockHeightLocktime(timelock.locktime)) {
      setCountdown("");
      return;
    }

    const updateCountdown = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const remaining = timelock.locktime - nowSec;
      if (remaining <= 0) {
        setCountdown("EXPIRED");
        return;
      }
      setCountdown(formatDuration(remaining));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [status, timelock.locktime]);

  // Block-height countdown (approximate)
  const blockCountdown = useMemo(() => {
    if (status !== "LOCKED" || !isBlockHeightLocktime(timelock.locktime) || !currentBlockHeight) {
      return null;
    }
    const remaining = timelock.locktime - currentBlockHeight;
    if (remaining <= 0) return "0 BLOCKS";
    return `${remaining.toLocaleString()} BLOCKS (~${formatDuration(remaining * 600)})`;
  }, [status, timelock.locktime, currentBlockHeight]);

  const statusClasses: Record<TimelockStatus, string> = {
    LOCKED: "text-crt border-crt",
    EXPIRED: "text-green-500 border-green-500",
    UNLOCKED: "text-crt-dim border-crt-dim",
  };

  const statusGlow: Record<TimelockStatus, string> = {
    LOCKED: "text-glow",
    EXPIRED: "",
    UNLOCKED: "",
  };

  return (
    <div className={`border ${statusClasses[status]} p-3 font-mono text-xs space-y-2`}>
      {/* Header row: mode + status badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`px-1.5 py-0.5 border text-[10px] uppercase tracking-wider ${statusClasses[status]} ${statusGlow[status]}`}>
            {status}
          </span>
          <span className="text-crt-bright">
            {timelock.mode === "inscription" ? "INSCRIPTION" : "BTC SATS"}
          </span>
        </div>
        {timelock.label && (
          <span className="text-crt-dim text-[10px] truncate max-w-[150px]">
            {timelock.label}
          </span>
        )}
      </div>

      {/* Details */}
      <div className="space-y-1">
        {/* Inscription info */}
        {timelock.mode === "inscription" && timelock.inscriptionId && (
          <div className="flex justify-between">
            <span className="text-crt-dim">INSCRIPTION:</span>
            <span className="text-crt">
              {timelock.inscriptionNumber
                ? `#${timelock.inscriptionNumber} `
                : ""}
              {truncateInscriptionId(timelock.inscriptionId)}
            </span>
          </div>
        )}

        {/* Locked value */}
        <div className="flex justify-between">
          <span className="text-crt-dim">LOCKED VALUE:</span>
          <span className="text-crt">
            {formatSats(timelock.lockedValueSats)} sats ({formatBtc(timelock.lockedValueSats)} BTC)
          </span>
        </div>

        {/* Locktime */}
        <div className="flex justify-between">
          <span className="text-crt-dim">UNLOCK {isBlockHeightLocktime(timelock.locktime) ? "BLOCK" : "DATE"}:</span>
          <span className={`${status === "EXPIRED" ? "text-green-500" : "text-crt-bright"} ${statusGlow[status]}`}>
            {formatLocktime(timelock.locktime)}
          </span>
        </div>

        {/* Countdown */}
        {status === "LOCKED" && (
          <div className="flex justify-between">
            <span className="text-crt-dim">REMAINING:</span>
            <span className="text-crt">
              {blockCountdown || countdown || "CALCULATING..."}
            </span>
          </div>
        )}

        {/* Lock TX */}
        <div className="flex justify-between">
          <span className="text-crt-dim">LOCK TX:</span>
          <a
            href={`https://mempool.space/tx/${timelock.lockTxid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-crt-bright hover:text-crt"
          >
            {timelock.lockTxid.slice(0, 12)}...
          </a>
        </div>

        {/* Unlock TX (if unlocked) */}
        {timelock.unlockTxid && (
          <div className="flex justify-between">
            <span className="text-crt-dim">UNLOCK TX:</span>
            <a
              href={`https://mempool.space/tx/${timelock.unlockTxid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-crt-bright hover:text-crt"
            >
              {timelock.unlockTxid.slice(0, 12)}...
            </a>
          </div>
        )}
      </div>

      {/* Unlock button */}
      {status === "EXPIRED" && (
        <div className="pt-1">
          <Button
            variant="primary"
            onClick={() => onUnlock(timelock)}
            className="w-full"
          >
            UNLOCK FUNDS
          </Button>
        </div>
      )}

      {/* Locked indicator */}
      {status === "LOCKED" && (
        <div className="border-t border-crt-border/30 pt-1 text-[10px] text-crt-dim text-center">
          FUNDS LOCKED BY BITCOIN PROTOCOL (OP_CHECKLOCKTIMEVERIFY)
        </div>
      )}
    </div>
  );
}

/**
 * Format seconds into human-readable duration.
 */
function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0s";

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (days === 0 && hours === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}
