# DEX Integration

## What is it?

Token swap aggregation via 1inch across 100+ liquidity sources on 10+ chains. Gets the best price by splitting orders across multiple DEXes (Uniswap, SushiSwap, Curve, Balancer, etc.).

## Common inputs

| Input | Description |
| ----- | ----------- |
| `api-key` | 1inch API key from [portal.1inch.dev](https://portal.1inch.dev) |
| `chain` | Target chain: `ethereum`, `base`, `arbitrum`, `polygon`, `optimism`, `avalanche`, `bnb`, `gnosis`, `zksync` |
| `rpc-url` | Custom RPC endpoint (optional) |

## Token addresses

Use the full ERC-20 contract address for tokens. For native tokens (ETH, MATIC, etc.), use `ETH` or `native` as a shorthand.

---

## Commands

### `quote`

Get the best swap price without executing. Use this to preview before swapping.

| Input | Required | Description |
| ----- | -------- | ----------- |
| `src` | yes | Source token address (or `ETH` for native) |
| `dst` | yes | Destination token address |
| `amount` | yes | Amount in base units (wei) |

**Output:** `{ chain, srcToken, dstToken, srcAmount, dstAmount, estimatedGas }`.

### `swap`

Execute a token swap. Auto-approves the source token if the 1inch router doesn't have sufficient allowance. **Write operation.**

| Input | Required | Description |
| ----- | -------- | ----------- |
| `src` | yes | Source token address |
| `dst` | yes | Destination token address |
| `amount` | yes | Amount in base units |
| `from` | yes | Sender wallet address |
| `slippage` | no | Max slippage % (default `1` = 1%) |
| `receiver` | no | Destination for output tokens (defaults to `from`) |

**Output:** `{ txHash, chain, srcToken, dstToken, srcAmount, dstAmount }`.

**Prerequisites:** `W3_SECRET_ETHEREUM` configured, `bridge-allow: [ethereum/send-transaction]`.

### `approve`

Manually approve a token for the 1inch router. Usually not needed — `swap` auto-approves. **Write operation.**

| Input | Required | Description |
| ----- | -------- | ----------- |
| `token` | yes | Token address to approve |
| `amount` | no | Amount to approve (omit for unlimited) |

**Output:** `{ txHash, chain, token, amount }`.

### `check-allowance`

Check if a token is approved for the 1inch router.

| Input | Required | Description |
| ----- | -------- | ----------- |
| `token` | yes | Token address |
| `wallet` | yes | Wallet address |

**Output:** `{ chain, token, wallet, allowance }`.

### `list-tokens`

List supported tokens on a chain (returns up to 50).

| Input | Required | Description |
| ----- | -------- | ----------- |
| `chain` | yes | Target chain |

**Output:** `{ chain, count, tokens: [{ symbol, name, address, decimals }] }`.

---

## Testing

```bash
npm test     # mocked tests
npm run all  # format + lint + test + build
```
