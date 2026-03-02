"use client";

import React from "react";
import Modal from "@/components/crt/Modal";
import { useWallet } from "@/hooks/useWallet";
import { getEnabledWallets, WALLET_INFO } from "@/lib/wallet/adapter";
import type { WalletType } from "@/lib/wallet/types";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { connect, connecting, error, clearError } = useWallet();
  const enabledWallets = getEnabledWallets();

  const handleConnect = async (type: WalletType) => {
    clearError();
    await connect(type);
    // Close modal on success (the context will update connected state)
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="CONNECT WALLET" width="sm">
      <div className="space-y-4">
        {/* Header */}
        <div className="text-crt-dim text-xs">
          <p>&gt; SELECT A WALLET TO CONNECT</p>
          <p>&gt; YOUR KEYS, YOUR ORDINALS</p>
        </div>

        {/* Divider */}
        <div className="border-t border-crt-border" />

        {/* Wallet options */}
        <div className="space-y-2">
          {enabledWallets.map(({ type, installed }) => {
            const info = WALLET_INFO[type];
            return (
              <button
                key={type}
                onClick={() => handleConnect(type)}
                disabled={!installed || connecting}
                className={`w-full text-left border px-3 py-2 font-mono text-sm transition-all duration-100 cursor-pointer ${
                  installed
                    ? "border-crt-dim hover:border-crt hover:bg-crt/5 text-crt"
                    : "border-crt-border/30 text-crt-dim cursor-not-allowed opacity-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Wallet icon */}
                    <span className="text-lg w-6 text-center text-crt-bright">
                      [{info.icon}]
                    </span>
                    <div>
                      <div className="text-sm font-bold tracking-wider">
                        {info.name.toUpperCase()}
                      </div>
                      <div className="text-[10px] text-crt-dim mt-0.5">
                        {info.description}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs">
                    {installed ? (
                      <span className="text-green-500">[READY]</span>
                    ) : (
                      <a
                        href={info.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-crt-bright hover:underline"
                      >
                        [INSTALL]
                      </a>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Error message */}
        {error && (
          <div className="border border-crt-error px-3 py-2 text-crt-error text-xs">
            <span className="font-bold">ERROR:</span> {error}
          </div>
        )}

        {/* Loading state */}
        {connecting && (
          <div className="text-center text-crt text-xs">
            CONNECTING<span className="crt-dots" />
          </div>
        )}

        {/* Info footer */}
        <div className="border-t border-crt-border pt-2 text-[10px] text-crt-dim text-center">
          WALLETS NEVER SHARE YOUR PRIVATE KEYS. ALL SIGNING HAPPENS LOCALLY.
        </div>
      </div>
    </Modal>
  );
}
