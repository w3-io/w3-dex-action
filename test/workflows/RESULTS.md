# E2E Test Results

> Last verified: 2026-04-15 -- NOT YET VERIFIED (KYB required at portal.1inch.dev)

## Prerequisites

| Credential    | Env var           | Source                          |
| ------------- | ----------------- | ------------------------------- |
| 1inch API key | `ONEINCH_API_KEY` | portal.1inch.dev (requires KYB) |

## Results

| #   | Step                   | Command           | Status  | Notes                       |
| --- | ---------------------- | ----------------- | ------- | --------------------------- |
| 1   | List tokens (Ethereum) | `list-tokens`     | BLOCKED | KYB required for API access |
| 2   | List tokens (Base)     | `list-tokens`     | BLOCKED | KYB required for API access |
| 3   | Quote ETH to USDC      | `quote`           | BLOCKED | KYB required for API access |
| 4   | Quote USDC to USDT     | `quote`           | BLOCKED | KYB required for API access |
| 5   | Check USDC allowance   | `check-allowance` | BLOCKED | KYB required for API access |

**Summary: 0/5 -- all commands blocked pending KYB verification
on portal.1inch.dev.**

## Skipped Commands

| Command   | Reason                       |
| --------- | ---------------------------- |
| `swap`    | Requires funded wallet + KYB |
| `approve` | Requires funded wallet + KYB |

## How to run

```bash
# Export credentials (requires KYB-verified account)
export ONEINCH_API_KEY="your-key-here"

# Run
w3 workflow test --execute test/workflows/e2e.yaml
```
