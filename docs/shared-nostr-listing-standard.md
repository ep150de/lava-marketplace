# Shared Nostr Listing Standard

This marketplace publishes ordinal listings to public Nostr relays so other forks or white-label marketplaces can discover and consume the same listings.

## Goals

- Keep seller listings portable across marketplaces
- Preserve trustless PSBT trading semantics
- Allow buyer marketplaces to apply their own fee policy
- Stay backward-compatible with existing relay data

## Event Shape

- Nostr kind: `30078`
- Replaceability: NIP-33 style via the `d` tag
- Event content: seller-signed listing PSBT in base64
- Tags: listing metadata used for discovery, filtering, and reconstruction

## Required Tags

- `d`: `lava-marketplace:listing:<inscriptionId>`
- `L`: `lava-marketplace`
- `l`: `listing`, `lava-marketplace`
- `protocol`: `lava-psbt-market`
- `version`: `1`
- `asset_type`: `ordinal`
- `market_scope`: `lava-lamps` or `all-ordinals`
- `fee_policy`: `buyer-marketplace`
- `collection`: collection or scope slug
- `inscription`: inscription ID
- `price`: sale price in sats
- `seller`: seller ordinals address
- `utxo`: `txid:vout`
- `offset`: inscription offset within the UTXO
- `utxo_value`: ordinal UTXO value in sats
- `listed_at`: unix timestamp

## Content

- `content`: base64 PSBT signed by the seller using `SIGHASH_SINGLE | SIGHASH_ANYONECANPAY`

The seller PSBT commits to the seller payment output but leaves room for the buyer marketplace to add:

- buyer funding inputs
- buyer receive output
- marketplace fee output
- change output

## Fee Policy

`fee_policy=buyer-marketplace` means the listing itself does not hardcode a marketplace fee. Each buyer-side marketplace may add its own fee output during purchase completion.

This marketplace currently applies a `2%` buyer-side marketplace fee.

## Market Scopes

- `lava-lamps`: curated Bitcoin Lava Lamps market
- `all-ordinals`: open ordinal market namespace for non-Lava inscriptions

Forks can use the same scopes or define additional scopes while still supporting these two.

## Cancellation

Listings are cancelled using two mechanisms:

1. NIP-33 replacement event with the same `d` tag and `status=cancelled`
2. NIP-09 kind `5` deletion event as a fallback

Consumers should filter out:

- events with `status=cancelled`
- events with empty content
- events whose IDs appear in kind `5` deletion events

## Backward Compatibility

Older listings may not include `protocol`, `version`, `asset_type`, `market_scope`, or `fee_policy`.

Consumers should fall back to legacy tags, especially:

- `collection`
- `inscription`
- `price`
- `seller`
- `utxo`
- `offset`
- `utxo_value`
- `listed_at`

If `market_scope` is missing, treat `collection=all-ordinals` as `all-ordinals`; otherwise default to `lava-lamps`.

## Consumer Notes

To support this listing format safely, a marketplace should:

- parse the seller PSBT from event content
- validate inscription transfer and sat routing before final broadcast
- verify the ordinal UTXO is still unspent on-chain
- deduplicate by inscription ID, keeping the most recent active listing

## Reference Implementation

- Tag builder/parser: `src/lib/nostr/event-schema.ts`
- Publish flow: `src/lib/nostr/publish-listing.ts`
- Query flow: `src/lib/nostr/query-listings.ts`
- Seller PSBT creation: `src/lib/psbt/create-listing.ts`
- Buyer PSBT completion: `src/lib/psbt/complete-purchase.ts`
