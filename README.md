# W3 DEX Action

DEX aggregation for W3 workflows — token swaps via 1inch across 10+ chains with best-price routing through 100+ liquidity sources including Uniswap, SushiSwap, Curve, Balancer, and more.

## Quick start

```yaml
# Get a swap quote
- uses: w3-io/w3-dex-action@v0
  id: quote
  with:
    command: quote
    api-key: ${{ secrets.ONEINCH_API_KEY }}
    chain: ethereum
    src: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    dst: ETH
    amount: '1000000000'

# Execute a swap (auto-approves if needed)
- uses: w3-io/w3-dex-action@v0
  env:
    W3_SECRET_ETHEREUM: ${{ secrets.W3_SECRET_ETHEREUM }}
  bridge-allow: [ethereum/send-transaction]
  with:
    command: swap
    api-key: ${{ secrets.ONEINCH_API_KEY }}
    chain: base
    src: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
    dst: ETH
    amount: '1000000'
    slippage: '0.5'
    from: '0xYourAddress'
```

## Commands

| Command           | Type  | Description                                 |
| ----------------- | ----- | ------------------------------------------- |
| `quote`           | read  | Get best swap price across 100+ DEXes       |
| `swap`            | write | Execute a swap (auto-approves source token) |
| `approve`         | write | Approve token for 1inch router              |
| `check-allowance` | read  | Check if token is approved                  |
| `list-tokens`     | read  | List supported tokens on a chain            |

## Chains

Ethereum, Base, Arbitrum, Polygon, Optimism, Avalanche, BNB Chain, Gnosis, zkSync Era.

## How it works

Uses the 1inch Aggregation Protocol API for routing and the W3 bridge for transaction signing. The API finds the best price across 100+ DEXes and returns ready-to-sign transaction data. The bridge signs and broadcasts — no private keys in the action container.

The `swap` command auto-approves the source token if needed, so a single step handles the full flow.

## Prerequisites

- 1inch API key from [portal.1inch.dev](https://portal.1inch.dev)
- Signer key configured via `W3_SECRET_ETHEREUM`

## Authentication

Two credentials — one API key for quotes/allowance reads, one
bridge signer for writes.

| Operation                                 | Needs                                                                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `quote`, `list-tokens`, `check-allowance` | 1inch API key (the `api-key` input). Bound to your account at portal.1inch.dev; subject to rate limits.  |
| `swap`, `approve`                         | API key **plus** a funded bridge signer. Signer stays on the bridge; the action container never sees it. |

> ⚠️ **KYB block.** 1inch gates production API keys behind a Know
> Your Business review at portal.1inch.dev. Until that clears for
> a given account, `quote` / `swap` calls will 401 or be rate-
> limited to unusable levels. This action's code is correct — the
> access is what's gated.

## Development

```bash
npm ci
npm run all    # format, lint, test, build
```
