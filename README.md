# LAVA TERMINAL

> Open-source, white-label secondary marketplace for Bitcoin Ordinals.
> Built for the **Bitcoin Lava Lamps: Wall of Entropy** collection.

```
  ╔═══════════════════════════════════════════╗
  ║   █     ▄▀▄  █ █  ▄▀▄                    ║
  ║   █     █▀█  ▀▄▀  █▀█                    ║
  ║   ▀▀▀   ▀ ▀   ▀   ▀ ▀                    ║
  ║          T E R M I N A L                  ║
  ╚═══════════════════════════════════════════╝
```

## Features

- **Trustless PSBT Trading** -- Sellers sign with `SIGHASH_SINGLE|ANYONECANPAY`, buyers complete with `SIGHASH_ALL`. No custodial risk.
- **Decentralized Listings** -- Listings stored on Nostr relays (NIP-78, kind 30078). Censorship-resistant.
- **Wallet Support** -- Xverse (via `sats-connect`) and Unisat (via `window.unisat`).
- **Inscription Safety** -- FIFO sat tracking validation before every broadcast prevents inscription burning.
- **Retro CRT Theme** -- Amber phosphor terminal UI with scanlines, flicker, glow, and curvature effects.
- **White-Label Ready** -- Single config file (`marketplace.config.ts`) + admin panel for runtime overrides.
- **Fully Client-Side** -- No backend required. Runs entirely in the browser.

## Quick Start

```bash
# Clone the repository
git clone <repo-url> lava-marketplace
cd lava-marketplace

# Install dependencies
npm install

# Copy environment file and add your Unisat API key
cp .env.example .env.local
# Edit .env.local and add your NEXT_PUBLIC_UNISAT_API_KEY

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Configuration

All marketplace settings are in `marketplace.config.ts`:

```typescript
const config: MarketplaceConfig = {
  collection: {
    name: "Bitcoin Lava Lamps: Wall of Entropy",
    slug: "lava-lamps",
    totalSupply: 1950,
    parentInscriptionIds: [...], // Your 65 parent inscription IDs
    grandparentId: "",           // Inscription #152930
    // ...
  },
  marketplace: {
    name: "LAVA TERMINAL",
    feePercent: 2,               // Marketplace fee (%)
    feeAddress: "",              // Your fee receiving BTC address
    minListingPriceSats: 10000,
    network: "mainnet",
  },
  theme: {
    variant: "amber",            // amber | green | blue | custom
    primaryColor: "#FFB000",
    scanlines: true,
    flicker: true,
    crtCurvature: true,
    // ...
  },
  nostr: {
    relays: [
      "wss://relay.damus.io",
      "wss://nos.lol",
      "wss://relay.nostr.band",
    ],
    eventKind: 30078,
  },
  indexer: {
    provider: "unisat",
    apiKey: process.env.NEXT_PUBLIC_UNISAT_API_KEY || "",
    baseUrl: "https://open-api.unisat.io",
  },
  wallets: {
    xverse: true,
    unisat: true,
  },
};
```

## White-Label Usage

To deploy your own marketplace for a different collection:

1. **Fork this repository**
2. **Edit `marketplace.config.ts`**:
   - Set your collection name, slug, and parent inscription IDs
   - Set your marketplace fee address and fee percentage
   - Customize the theme (colors, effects)
   - Configure Nostr relays
3. **Get a Unisat API key** at [developer.unisat.io](https://developer.unisat.io/)
4. **Set the environment variable**: `NEXT_PUBLIC_UNISAT_API_KEY=your-key`
5. **Deploy** to Vercel, Netlify, or any static hosting

The admin panel at `/admin` allows runtime config overrides stored in localStorage.

## Architecture

### Trading Protocol (PSBT)

```
SELLER creates listing:
  Input 0:  Ordinal UTXO (signed SIGHASH_SINGLE|ANYONECANPAY)
  Output 0: Seller payment (listing price)

BUYER completes purchase:
  Input 0:  Ordinal UTXO (seller's signature)
  Input 1+: Buyer's payment UTXOs (signed SIGHASH_ALL)
  Output 0: Seller payment
  Output 1: Buyer receives inscription
  Output 2: Marketplace fee (2%)
  Output 3: Buyer's change
```

### Nostr Identity

Users don't need a separate Nostr identity. The marketplace derives a Nostr keypair from a Bitcoin wallet message signature:

1. User signs a specific message with their ordinals address
2. The signature is SHA-256 hashed to produce a 32-byte Nostr private key
3. This keypair is used to publish/cancel listings on Nostr relays

### Project Structure

```
lava-marketplace/
├── marketplace.config.ts          # White-label configuration
├── src/
│   ├── app/                       # Next.js App Router pages
│   │   ├── page.tsx               # Home / Gallery
│   │   ├── item/[id]/page.tsx     # Item detail
│   │   ├── my-listings/page.tsx   # User's inscriptions & listings
│   │   ├── activity/page.tsx      # Activity feed
│   │   ├── about/page.tsx         # About the collection
│   │   └── admin/page.tsx         # Admin config panel
│   ├── components/
│   │   ├── crt/                   # CRT UI component library
│   │   ├── marketplace/           # Marketplace components
│   │   ├── wallet/                # Wallet connection UI
│   │   └── layout/                # Header, Nav, Footer
│   ├── lib/
│   │   ├── psbt/                  # PSBT creation, completion, validation
│   │   ├── nostr/                 # Nostr relay client, event publishing
│   │   ├── ordinals/              # Unisat indexer, inscription utilities
│   │   └── wallet/                # Wallet adapters (Xverse, Unisat)
│   ├── hooks/                     # React hooks
│   ├── context/                   # Wallet + Marketplace providers
│   └── utils/                     # Constants, formatting, address utils
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS v4
- **Bitcoin**: bitcoinjs-lib v7, @bitcoinerlab/secp256k1
- **Nostr**: nostr-tools v2, @noble/hashes
- **Wallets**: sats-connect (Xverse), window.unisat (Unisat)
- **Language**: TypeScript (strict mode)

## API Dependencies

| Service | Purpose | Required |
|---------|---------|----------|
| [Unisat Open API](https://developer.unisat.io/) | Inscription data, ownership lookup | Yes (API key needed) |
| [mempool.space](https://mempool.space/) | UTXOs, fee rates, broadcasting, block height | Yes (no key needed) |
| [ordinals.com](https://ordinals.com/) | Inscription content/preview rendering | Yes (no key needed) |
| Nostr relays | Listing storage | Yes (no key needed) |

## Development

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Security Considerations

- **Inscription Safety**: FIFO sat tracking validates that inscriptions transfer to the correct output before broadcasting
- **Cardinal-only Coin Selection**: Payment UTXOs are filtered to exclude any containing inscriptions
- **UTXO Verification**: Listings are verified against mempool.space to ensure UTXOs are still unspent
- **No Private Keys**: The marketplace never has access to private keys -- all signing happens in the wallet
- **Client-Side Only**: No server, no database, no custodial risk

## License

MIT

## Credits

- **Collection**: "Bitcoin Lava Lamps: Wall of Entropy" by Lingle
- **Grandparent Inscription**: #152930 "World Peace"
- **Trading Protocol**: Based on BIP-174 PSBT specification and ordinal theory
