"use client";

import React, { useState, useEffect } from "react";
import { Button, Input, TextArea } from "@/components/crt";
import config, { type MarketplaceConfig } from "../../../marketplace.config";

const ADMIN_STORAGE_KEY = "lava-marketplace-admin-overrides";

type ConfigOverrides = Partial<{
  collection: Partial<MarketplaceConfig["collection"]>;
  marketplace: Partial<MarketplaceConfig["marketplace"]>;
  theme: Partial<MarketplaceConfig["theme"]>;
  nostr: Partial<MarketplaceConfig["nostr"]>;
  indexer: Partial<MarketplaceConfig["indexer"]>;
  wallets: Partial<MarketplaceConfig["wallets"]>;
}>;

export default function AdminPage() {
  const [overrides, setOverrides] = useState<ConfigOverrides>({});
  const [activeTab, setActiveTab] = useState<
    "collection" | "marketplace" | "theme" | "nostr" | "indexer" | "export"
  >("collection");
  const [saved, setSaved] = useState(false);
  const [jsonExport, setJsonExport] = useState("");

  // Load overrides from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
      if (stored) {
        setOverrides(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  // Get merged config
  const merged: MarketplaceConfig = {
    collection: { ...config.collection, ...overrides.collection },
    marketplace: { ...config.marketplace, ...overrides.marketplace },
    theme: { ...config.theme, ...overrides.theme },
    nostr: { ...config.nostr, ...overrides.nostr },
    indexer: { ...config.indexer, ...overrides.indexer },
    wallets: { ...config.wallets, ...overrides.wallets },
  };

  const saveOverrides = () => {
    try {
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(overrides));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    }
  };

  const clearOverrides = () => {
    setOverrides({});
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateOverride = <K extends keyof ConfigOverrides>(
    section: K,
    key: string,
    value: string | number | boolean
  ) => {
    setOverrides((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] || {}),
        [key]: value,
      },
    }));
  };

  const generateExport = () => {
    const exportConfig = {
      ...config,
      ...overrides,
      collection: { ...config.collection, ...overrides.collection },
      marketplace: { ...config.marketplace, ...overrides.marketplace },
      theme: { ...config.theme, ...overrides.theme },
      nostr: { ...config.nostr, ...overrides.nostr },
      indexer: { ...config.indexer, ...overrides.indexer },
      wallets: { ...config.wallets, ...overrides.wallets },
    };
    setJsonExport(JSON.stringify(exportConfig, null, 2));
  };

  const tabs = [
    { key: "collection" as const, label: "COLLECTION" },
    { key: "marketplace" as const, label: "MARKETPLACE" },
    { key: "theme" as const, label: "THEME" },
    { key: "nostr" as const, label: "NOSTR" },
    { key: "indexer" as const, label: "INDEXER" },
    { key: "export" as const, label: "EXPORT" },
  ];

  return (
    <div className="space-y-4 font-mono max-w-3xl mx-auto">
      {/* Header */}
      <div className="border-b border-crt-dim pb-2">
        <div className="text-crt-bright text-sm">ADMIN PANEL</div>
        <div className="text-crt-dim text-xs mt-1">
          CONFIGURE MARKETPLACE SETTINGS | OVERRIDES STORED IN LOCALSTORAGE
        </div>
      </div>

      {/* Warning */}
      <div className="border border-crt-border/50 p-2 text-[10px] text-crt-dim">
        NOTE: CHANGES HERE ARE STORED IN YOUR BROWSER&apos;S LOCALSTORAGE AND OVERRIDE
        THE DEFAULT marketplace.config.ts VALUES. TO MAKE PERMANENT CHANGES, UPDATE
        THE CONFIG FILE DIRECTLY AND REBUILD.
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-2 py-1 text-xs cursor-pointer ${
              activeTab === tab.key
                ? "bg-crt text-crt-bg"
                : "text-crt-dim border border-crt-border/30 hover:text-crt hover:border-crt"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Collection settings */}
      {activeTab === "collection" && (
        <div className="border border-crt-border p-4 space-y-3">
          <div className="text-crt-bright text-xs border-b border-crt-border/30 pb-2">
            COLLECTION SETTINGS
          </div>
          <Input
            label="COLLECTION NAME"
            value={overrides.collection?.name ?? config.collection.name}
            onChange={(e) => updateOverride("collection", "name", e.target.value)}
          />
          <Input
            label="COLLECTION SLUG"
            value={overrides.collection?.slug ?? config.collection.slug}
            onChange={(e) => updateOverride("collection", "slug", e.target.value)}
          />
          <Input
            label="ARTIST"
            value={overrides.collection?.artist ?? config.collection.artist}
            onChange={(e) => updateOverride("collection", "artist", e.target.value)}
          />
          <Input
            label="TOTAL SUPPLY"
            type="number"
            value={String(overrides.collection?.totalSupply ?? config.collection.totalSupply)}
            onChange={(e) => updateOverride("collection", "totalSupply", parseInt(e.target.value, 10) || 0)}
          />
          <Input
            label="GRANDPARENT ID"
            value={overrides.collection?.grandparentId ?? config.collection.grandparentId}
            onChange={(e) => updateOverride("collection", "grandparentId", e.target.value)}
          />
          <div className="text-crt-dim text-[10px] mt-2">
            PARENT INSCRIPTION IDS AND COLORS ARRAY MUST BE EDITED IN marketplace.config.ts DIRECTLY
          </div>
        </div>
      )}

      {/* Marketplace settings */}
      {activeTab === "marketplace" && (
        <div className="border border-crt-border p-4 space-y-3">
          <div className="text-crt-bright text-xs border-b border-crt-border/30 pb-2">
            MARKETPLACE SETTINGS
          </div>
          <Input
            label="MARKETPLACE NAME"
            value={overrides.marketplace?.name ?? config.marketplace.name}
            onChange={(e) => updateOverride("marketplace", "name", e.target.value)}
          />
          <Input
            label="FEE PERCENT"
            type="number"
            step="0.1"
            value={String(overrides.marketplace?.feePercent ?? config.marketplace.feePercent)}
            onChange={(e) => updateOverride("marketplace", "feePercent", parseFloat(e.target.value) || 0)}
          />
          <Input
            label="FEE ADDRESS"
            value={overrides.marketplace?.feeAddress ?? config.marketplace.feeAddress}
            onChange={(e) => updateOverride("marketplace", "feeAddress", e.target.value)}
          />
          <Input
            label="MIN LISTING PRICE (sats)"
            type="number"
            value={String(overrides.marketplace?.minListingPriceSats ?? config.marketplace.minListingPriceSats)}
            onChange={(e) => updateOverride("marketplace", "minListingPriceSats", parseInt(e.target.value, 10) || 0)}
          />
          <div className="text-xs">
            <span className="text-crt-dim">NETWORK: </span>
            <span className="text-crt">{merged.marketplace.network.toUpperCase()}</span>
            <span className="text-crt-dim text-[10px] ml-2">(EDIT IN CONFIG FILE)</span>
          </div>
        </div>
      )}

      {/* Theme settings */}
      {activeTab === "theme" && (
        <div className="border border-crt-border p-4 space-y-3">
          <div className="text-crt-bright text-xs border-b border-crt-border/30 pb-2">
            THEME SETTINGS
          </div>
          <Input
            label="PRIMARY COLOR"
            value={overrides.theme?.primaryColor ?? config.theme.primaryColor}
            onChange={(e) => updateOverride("theme", "primaryColor", e.target.value)}
          />
          <Input
            label="PRIMARY DIM"
            value={overrides.theme?.primaryDim ?? config.theme.primaryDim}
            onChange={(e) => updateOverride("theme", "primaryDim", e.target.value)}
          />
          <Input
            label="PRIMARY BRIGHT"
            value={overrides.theme?.primaryBright ?? config.theme.primaryBright}
            onChange={(e) => updateOverride("theme", "primaryBright", e.target.value)}
          />
          <Input
            label="BACKGROUND COLOR"
            value={overrides.theme?.backgroundColor ?? config.theme.backgroundColor}
            onChange={(e) => updateOverride("theme", "backgroundColor", e.target.value)}
          />
          <Input
            label="ERROR COLOR"
            value={overrides.theme?.errorColor ?? config.theme.errorColor}
            onChange={(e) => updateOverride("theme", "errorColor", e.target.value)}
          />
          <Input
            label="BORDER COLOR"
            value={overrides.theme?.borderColor ?? config.theme.borderColor}
            onChange={(e) => updateOverride("theme", "borderColor", e.target.value)}
          />
          <div className="space-y-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={overrides.theme?.scanlines ?? config.theme.scanlines}
                onChange={(e) => updateOverride("theme", "scanlines", e.target.checked)}
                className="accent-[var(--crt-primary)]"
              />
              <span className="text-crt">SCANLINES</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={overrides.theme?.flicker ?? config.theme.flicker}
                onChange={(e) => updateOverride("theme", "flicker", e.target.checked)}
                className="accent-[var(--crt-primary)]"
              />
              <span className="text-crt">FLICKER EFFECT</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={overrides.theme?.crtCurvature ?? config.theme.crtCurvature}
                onChange={(e) => updateOverride("theme", "crtCurvature", e.target.checked)}
                className="accent-[var(--crt-primary)]"
              />
              <span className="text-crt">CRT CURVATURE</span>
            </label>
          </div>
          <div className="text-crt-dim text-[10px] mt-2">
            NOTE: THEME CHANGES REQUIRE PAGE RELOAD TO TAKE EFFECT IF CSS VARIABLES ARE USED
          </div>
        </div>
      )}

      {/* Nostr settings */}
      {activeTab === "nostr" && (
        <div className="border border-crt-border p-4 space-y-3">
          <div className="text-crt-bright text-xs border-b border-crt-border/30 pb-2">
            NOSTR RELAY SETTINGS
          </div>
          <div className="space-y-1">
            <div className="text-crt-dim text-xs">CURRENT RELAYS:</div>
            {merged.nostr.relays.map((relay, i) => (
              <div key={i} className="text-crt text-xs">
                &gt; {relay}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-crt-dim">EVENT KIND:</span>
            <span className="text-crt">{merged.nostr.eventKind}</span>
          </div>
          <div className="text-crt-dim text-[10px]">
            RELAY LIST MUST BE EDITED IN marketplace.config.ts DIRECTLY
          </div>
        </div>
      )}

      {/* Indexer settings */}
      {activeTab === "indexer" && (
        <div className="border border-crt-border p-4 space-y-3">
          <div className="text-crt-bright text-xs border-b border-crt-border/30 pb-2">
            INDEXER SETTINGS
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-crt-dim">PROVIDER:</span>
            <span className="text-crt">{merged.indexer.provider.toUpperCase()}</span>
          </div>
          <Input
            label="API BASE URL"
            value={overrides.indexer?.baseUrl ?? config.indexer.baseUrl}
            onChange={(e) => updateOverride("indexer", "baseUrl", e.target.value)}
          />
          <div className="flex justify-between text-xs">
            <span className="text-crt-dim">API KEY:</span>
            <span className="text-crt">
              {merged.indexer.apiKey ? `${merged.indexer.apiKey.slice(0, 8)}...` : "NOT SET"}
            </span>
          </div>
          <div className="text-crt-dim text-[10px]">
            API KEY MUST BE SET VIA NEXT_PUBLIC_UNISAT_API_KEY ENVIRONMENT VARIABLE
          </div>
          <div className="space-y-2 text-xs mt-3">
            <div className="text-crt-bright">WALLET SUPPORT:</div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={overrides.wallets?.xverse ?? config.wallets.xverse}
                onChange={(e) => updateOverride("wallets", "xverse", e.target.checked)}
                className="accent-[var(--crt-primary)]"
              />
              <span className="text-crt">XVERSE</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={overrides.wallets?.unisat ?? config.wallets.unisat}
                onChange={(e) => updateOverride("wallets", "unisat", e.target.checked)}
                className="accent-[var(--crt-primary)]"
              />
              <span className="text-crt">UNISAT</span>
            </label>
          </div>
        </div>
      )}

      {/* Export */}
      {activeTab === "export" && (
        <div className="border border-crt-border p-4 space-y-3">
          <div className="text-crt-bright text-xs border-b border-crt-border/30 pb-2">
            CONFIG EXPORT
          </div>
          <div className="text-crt-dim text-xs">
            GENERATE A JSON EXPORT OF THE CURRENT CONFIGURATION (BASE + OVERRIDES).
            USE THIS TO UPDATE YOUR marketplace.config.ts FILE.
          </div>
          <Button variant="primary" onClick={generateExport}>
            GENERATE EXPORT
          </Button>
          {jsonExport && (
            <div className="mt-2">
              <TextArea
                label="CONFIGURATION JSON"
                value={jsonExport}
                readOnly
                rows={20}
                className="text-[10px]"
              />
              <Button
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(jsonExport);
                }}
                className="mt-2"
              >
                COPY TO CLIPBOARD
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between border-t border-crt-dim pt-3">
        <Button variant="danger" onClick={clearOverrides}>
          CLEAR ALL OVERRIDES
        </Button>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-green-500 text-xs">SAVED!</span>
          )}
          <Button variant="primary" onClick={saveOverrides}>
            SAVE OVERRIDES
          </Button>
        </div>
      </div>

      {/* Current overrides display */}
      {Object.keys(overrides).length > 0 && (
        <div className="border border-crt-border/30 p-3 text-[10px] text-crt-dim">
          <div className="mb-1">ACTIVE OVERRIDES:</div>
          <pre className="overflow-x-auto">{JSON.stringify(overrides, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
