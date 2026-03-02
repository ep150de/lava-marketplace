import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "./ClientLayout";

export const metadata: Metadata = {
  title: "LAVA TERMINAL — Bitcoin Lava Lamps: Wall of Entropy Marketplace",
  description:
    "An open-source secondary ordinals marketplace for the Bitcoin Lava Lamps: Wall of Entropy collection. " +
    "1,950 inscriptions across 22 colors + 1 mystery. Trade trustlessly via PSBTs on Bitcoin.",
  keywords: [
    "bitcoin",
    "ordinals",
    "inscriptions",
    "lava lamps",
    "wall of entropy",
    "marketplace",
    "PSBT",
    "nostr",
  ],
  openGraph: {
    title: "LAVA TERMINAL — Ordinals Marketplace",
    description: "Trade Bitcoin Lava Lamps ordinals trustlessly. Open source & white-labelable.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-mono">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
