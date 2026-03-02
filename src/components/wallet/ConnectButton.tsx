"use client";

import React from "react";
import { useWallet } from "@/hooks/useWallet";
import { truncateAddress } from "@/utils/format";
import Button from "@/components/crt/Button";

interface ConnectButtonProps {
  onOpenModal: () => void;
  className?: string;
}

export default function ConnectButton({ onOpenModal, className = "" }: ConnectButtonProps) {
  const { connected, type, paymentAddress, ordinalsAddress, disconnect, connecting } = useWallet();

  if (connected && ordinalsAddress) {
    return (
      <div className={`flex items-center gap-2 font-mono text-xs ${className}`}>
        <div className="flex items-center gap-2 border border-crt-dim px-2 py-1">
          <span className="text-green-500">&#9679;</span>
          <span className="text-crt-dim">{type?.toUpperCase()}</span>
          <span className="text-crt">{truncateAddress(ordinalsAddress)}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={disconnect}>
          DISCONNECT
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="primary"
      size="sm"
      onClick={onOpenModal}
      loading={connecting}
      className={className}
    >
      CONNECT WALLET
    </Button>
  );
}
