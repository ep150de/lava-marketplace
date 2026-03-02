"use client";

import React, { useState } from "react";
import { WalletProvider } from "@/context/WalletContext";
import { MarketplaceProvider } from "@/context/MarketplaceContext";
import { CRTScreen, StatusBar } from "@/components/crt";
import { Header, Nav, Footer } from "@/components/layout";
import { ConnectButton, WalletModal } from "@/components/wallet";
import { useWalletContext } from "@/context/WalletContext";
import { useMarketplaceContext } from "@/context/MarketplaceContext";
import config from "../../marketplace.config";

function InnerLayout({ children }: { children: React.ReactNode }) {
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const { connected, type, ordinalsAddress } = useWalletContext();
  const { blockHeight } = useMarketplaceContext();

  return (
    <CRTScreen>
      <div className="flex flex-col min-h-screen">
        {/* Header area */}
        <div className="px-2 sm:px-4 pt-2">
          {/* Wallet button - top right */}
          <div className="flex justify-end mb-2">
            <ConnectButton onOpenModal={() => setWalletModalOpen(true)} />
          </div>

          {/* ASCII Header */}
          <Header />
        </div>

        {/* Navigation */}
        <Nav className="mt-2" />

        {/* Main content */}
        <main className="flex-1 px-2 sm:px-4 py-4 page-enter">
          {children}
        </main>

        {/* Footer */}
        <Footer />

        {/* Status Bar */}
        <StatusBar
          walletAddress={ordinalsAddress || undefined}
          walletType={type || undefined}
          blockHeight={blockHeight || undefined}
          network={config.marketplace.network.toUpperCase()}
          connected={connected}
          className="sticky bottom-0"
        />
      </div>

      {/* Wallet connection modal */}
      <WalletModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />
    </CRTScreen>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <MarketplaceProvider>
        <InnerLayout>{children}</InnerLayout>
      </MarketplaceProvider>
    </WalletProvider>
  );
}
