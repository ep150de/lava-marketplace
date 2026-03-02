"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "GALLERY", key: "gallery" },
  { href: "/my-listings", label: "MY LAMPS", key: "my-listings" },
  { href: "/activity", label: "ACTIVITY", key: "activity" },
  { href: "/about", label: "ABOUT", key: "about" },
  { href: "/admin", label: "ADMIN", key: "admin" },
];

interface NavProps {
  className?: string;
}

export default function Nav({ className = "" }: NavProps) {
  const pathname = usePathname();

  return (
    <nav className={`font-mono ${className}`}>
      <div className="border-y border-crt-dim py-1.5 px-3 flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
        {NAV_ITEMS.map((item, idx) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname?.startsWith(item.href);

          return (
            <React.Fragment key={item.key}>
              {idx > 0 && (
                <span className="text-crt-border text-xs hidden sm:inline">|</span>
              )}
              <Link
                href={item.href}
                className={`text-xs sm:text-sm px-2 py-0.5 tracking-wider transition-all duration-100 no-underline ${
                  isActive
                    ? "text-crt-bg bg-crt font-bold"
                    : "text-crt-dim hover:text-crt hover:bg-crt/10"
                }`}
              >
                [{item.label}]
              </Link>
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
}
