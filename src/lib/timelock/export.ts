import type { TimelockRecord } from "@/lib/nostr/timelock-schema";

export interface TimelockBackupFile {
  format: "lava-marketplace-timelocks";
  version: 1;
  exportedAt: number;
  ownerAddress: string;
  count: number;
  timelocks: TimelockRecord[];
}

/**
 * Download a JSON backup containing all timelock metadata needed to recover
 * and unlock funds from another browser or device.
 */
export function exportTimelocksBackup(
  ownerAddress: string,
  timelocks: TimelockRecord[]
): void {
  if (typeof window === "undefined") return;

  const backup: TimelockBackupFile = {
    format: "lava-marketplace-timelocks",
    version: 1,
    exportedAt: Math.floor(Date.now() / 1000),
    ownerAddress,
    count: timelocks.length,
    timelocks,
  };

  const exportedDate = new Date().toISOString().slice(0, 10);
  const safeAddress = ownerAddress.slice(0, 12);
  const fileName = `lava-timelocks-${safeAddress}-${exportedDate}.json`;

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
