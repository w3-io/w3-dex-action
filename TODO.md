# TODO

## KYB-blocked (hard)

1inch gates production API key issuance behind a Know Your Business
review. Until KYB clears:

- [ ] All live E2E verification — RESULTS.md says "NOT YET VERIFIED
      (KYB required)." The action's code is correct; the block is
      access, not capability.

The 5 commands (`quote`, `swap`, `approve`, `check-allowance`,
`list-tokens`) all share the same dependency on an approved API key.
When KYB clears:

1. Paste the API key as `ONEINCH_API_KEY` (or whatever secret name
   you pick — the action-input name is `api-key`, the secret name is
   yours).
2. Re-run `w3 workflow test --execute test/workflows/e2e.yaml`.
3. Update RESULTS.md with real PASS/FAIL per step.

## Repo rename residue

Per memory: this repo was renamed from `w3-dex-action` → `w3-1inch-action`
on 2026-04-15. GitHub redirects the old URL, so existing workflows
that reference `w3-io/w3-dex-action@v0` should continue to work,
but:

- [x] README's Quick Start still shows `uses: w3-io/w3-dex-action@v0`.
      Update to `w3-io/w3-1inch-action@v0` so new users copy-paste
      the canonical name.
- [x] `docs/guide.md` likely has the same stale reference. Check
      and fix. (No stale references found in docs/guide.md.)

## Potential additions

- [ ] 1inch Fusion mode — intent-based swaps with MEV protection
      (similar story to CowSwap). Different endpoint, different
      signing flow. Separate command set.
- [ ] Limit orders — 1inch's limit-order protocol. Non-trivial
      signing.
- [ ] `get-spender` — returns the 1inch router address for a chain.
      Trivial utility but handy for workflows that want to verify
      approvals against the current router.
