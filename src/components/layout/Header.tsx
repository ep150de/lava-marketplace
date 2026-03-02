"use client";

import React from "react";
import config from "../../../marketplace.config";

const ASCII_LOGO = `
    ██╗      █████╗ ██╗   ██╗ █████╗     ████████╗███████╗██████╗ ███╗   ███╗██╗███╗   ██╗ █████╗ ██╗     
    ██║     ██╔══██╗██║   ██║██╔══██╗    ╚══██╔══╝██╔════╝██╔══██╗████╗ ████║██║████╗  ██║██╔══██╗██║     
    ██║     ███████║██║   ██║███████║       ██║   █████╗  ██████╔╝██╔████╔██║██║██╔██╗ ██║███████║██║     
    ██║     ██╔══██║╚██╗ ██╔╝██╔══██║       ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║██║██║╚██╗██║██╔══██║██║     
    ███████╗██║  ██║ ╚████╔╝ ██║  ██║       ██║   ███████╗██║  ██║██║ ╚═╝ ██║██║██║ ╚████║██║  ██║███████╗
    ╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚═╝  ╚═╝       ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝`;

const LAVA_LAMP_ART = `
      ┌──────────┐  ┌──────────┐  ┌──────────┐
      │ ╭──────╮ │  │ ╭──────╮ │  │ ╭──────╮ │
      │ │  ██  │ │  │ │ ░░░░ │ │  │ │  ▓▓  │ │
      │ │ ████ │ │  │ │░░  ░░│ │  │ │▓▓  ▓▓│ │
      │ │██████│ │  │ │ ░░░░ │ │  │ │ ▓▓▓▓ │ │
      │ │ ████ │ │  │ │░░░░░░│ │  │ │▓▓▓▓▓▓│ │
      │ │  ██  │ │  │ │ ░░░░ │ │  │ │ ▓▓▓▓ │ │
      │ │ ████ │ │  │ │░░  ░░│ │  │ │▓▓  ▓▓│ │
      │ │██  ██│ │  │ │ ░░░░ │ │  │ │  ▓▓  │ │
      │ │ ████ │ │  │ │░░░░░░│ │  │ │ ▓▓▓▓ │ │
      │ ╰──────╯ │  │ ╰──────╯ │  │ ╰──────╯ │
      │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │
      │ │ BASE │ │  │ │ BASE │ │  │ │ BASE │ │
      └─┴──────┴─┘  └─┴──────┴─┘  └─┴──────┴─┘`;

const SUB_HEADER = `
  ╔══════════════════════════════════════════════════════════════════════════╗
  ║        BITCOIN LAVA LAMPS: WALL OF ENTROPY — ORDINALS MARKETPLACE      ║
  ║            1,950 INSCRIPTIONS  |  22 COLORS + 1 MYSTERY  |  est. 2023  ║
  ╚══════════════════════════════════════════════════════════════════════════╝`;

interface HeaderProps {
  className?: string;
  compact?: boolean;
}

export default function Header({ className = "", compact = false }: HeaderProps) {
  return (
    <header className={`${className}`}>
      {/* ASCII Logo */}
      <div className="overflow-x-auto">
        <pre className="ascii-glow text-[8px] sm:text-[10px] md:text-xs leading-tight whitespace-pre text-center">
          {compact ? "" : ASCII_LOGO}
        </pre>
      </div>

      {/* Lava Lamp Art */}
      {!compact && (
        <div className="overflow-x-auto">
          <pre className="text-crt text-[8px] sm:text-[10px] md:text-xs leading-tight whitespace-pre text-center text-glow">
            {LAVA_LAMP_ART}
          </pre>
        </div>
      )}

      {/* Sub-header box */}
      <div className="overflow-x-auto">
        <pre className="text-crt text-[9px] sm:text-[10px] md:text-xs leading-tight whitespace-pre text-center">
          {SUB_HEADER}
        </pre>
      </div>

      {/* Version / attribution line */}
      <div className="text-center text-crt-dim text-xs mt-1 font-mono">
        {config.marketplace.name} v1.0 — by {config.collection.artist} — OPEN SOURCE
      </div>
    </header>
  );
}
