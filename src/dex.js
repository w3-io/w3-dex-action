/**
 * DEX aggregation client via 1inch Swap API v6.
 *
 * Uses 1inch for routing (finds best price across 100+ DEXes)
 * and the W3 bridge for transaction signing/execution.
 *
 * Flow for a swap:
 *   1. Quote: GET /quote → preview price
 *   2. Approve: GET /approve/allowance → check, then GET /approve/transaction → sign
 *   3. Swap: GET /swap → get calldata → bridge.chain('send-transaction') → execute
 *
 * The 1inch API returns ready-to-sign transaction objects that map
 * directly to the bridge's send-transaction syscall.
 */

import { W3ActionError, bridge, request } from '@w3-io/action-core'

export class DexError extends W3ActionError {
  constructor(code, message, { details } = {}) {
    super(code, message, { details })
    this.name = 'DexError'
  }
}

// ── 1inch API ─────────────────────────────────────────────────────

const API_BASE = 'https://api.1inch.dev/swap/v6.0'

// Native token address placeholder used by 1inch
const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

const CHAINS = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  polygon: 137,
  optimism: 10,
  avalanche: 43114,
  bnb: 56,
  gnosis: 100,
  zksync: 324,
}

const BRIDGE_NETWORKS = {
  ethereum: 'ethereum',
  base: 'base',
  arbitrum: 'arbitrum',
  polygon: 'polygon',
  optimism: 'optimism',
  avalanche: 'avalanche',
  bnb: 'bnb',
  gnosis: 'gnosis',
  zksync: 'zksync',
}

function resolveChain(chain) {
  const key = chain.toLowerCase()
  const chainId = CHAINS[key]
  if (!chainId) {
    throw new DexError(
      'UNSUPPORTED_CHAIN',
      `Chain "${chain}" not supported. Available: ${Object.keys(CHAINS).join(', ')}`,
    )
  }
  return { chainId, bridgeNetwork: BRIDGE_NETWORKS[key] }
}

function resolveToken(token) {
  if (!token) throw new DexError('MISSING_TOKEN', 'token address is required')
  // Allow "ETH", "NATIVE", or "native" as aliases for native token
  if (['ETH', 'NATIVE', 'native', 'eth'].includes(token)) return NATIVE_TOKEN
  return token
}

function validateAddress(addr, label) {
  if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) {
    throw new DexError('INVALID_ADDRESS', `${label} must be a valid Ethereum address`)
  }
}

async function apiCall(apiKey, chainId, path, params = {}) {
  const url = new URL(`${API_BASE}/${chainId}${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value))
    }
  }

  const result = await request(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  return result
}

// ── Read operations ───────────────────────────────────────────────

/**
 * Get a swap quote — best price without generating calldata.
 */
export async function quote(apiKey, chain, { src, dst, amount }) {
  if (!src) throw new DexError('MISSING_TOKEN', 'src token is required')
  if (!dst) throw new DexError('MISSING_TOKEN', 'dst token is required')
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    throw new DexError('INVALID_AMOUNT', 'amount must be a positive number')
  }

  const { chainId } = resolveChain(chain)
  const srcToken = resolveToken(src)
  const dstToken = resolveToken(dst)
  if (srcToken !== NATIVE_TOKEN) validateAddress(srcToken, 'src token')
  if (dstToken !== NATIVE_TOKEN) validateAddress(dstToken, 'dst token')

  const result = await apiCall(apiKey, chainId, '/quote', {
    src: srcToken,
    dst: dstToken,
    amount,
    includeTokensInfo: true,
    includeGas: true,
  })

  return {
    chain,
    srcToken: result.srcToken?.symbol ?? src,
    dstToken: result.dstToken?.symbol ?? dst,
    srcAmount: amount,
    dstAmount: String(result.dstAmount),
    estimatedGas: String(result.gas ?? '0'),
  }
}

/**
 * Check the current allowance for the 1inch router.
 */
export async function checkAllowance(apiKey, chain, { token, wallet }) {
  if (!token) throw new DexError('MISSING_TOKEN', 'token address is required')
  if (!wallet) throw new DexError('MISSING_WALLET', 'wallet address is required')

  const { chainId } = resolveChain(chain)
  const resolved = resolveToken(token)
  if (resolved !== NATIVE_TOKEN) validateAddress(resolved, 'token')
  validateAddress(wallet, 'wallet')

  const result = await apiCall(apiKey, chainId, '/approve/allowance', {
    tokenAddress: resolved,
    walletAddress: wallet,
  })

  return {
    chain,
    token: resolved,
    wallet,
    allowance: String(result.allowance),
  }
}

/**
 * List supported tokens on a chain.
 */
export async function listTokens(apiKey, chain) {
  const { chainId } = resolveChain(chain)
  const result = await apiCall(apiKey, chainId, '/tokens')

  const tokens = Object.values(result.tokens || {}).map((t) => ({
    symbol: t.symbol,
    name: t.name,
    address: t.address,
    decimals: t.decimals,
  }))

  return {
    chain,
    count: tokens.length,
    tokens: tokens.slice(0, 50), // Cap at 50 to avoid huge outputs
  }
}

// ── Write operations ──────────────────────────────────────────────

/**
 * Approve a token for the 1inch router.
 */
export async function approve(apiKey, chain, { token, amount, rpcUrl }) {
  if (!token) throw new DexError('MISSING_TOKEN', 'token address is required')

  const { chainId, bridgeNetwork } = resolveChain(chain)
  const resolved = resolveToken(token)
  if (resolved !== NATIVE_TOKEN) validateAddress(resolved, 'token')

  const result = await apiCall(apiKey, chainId, '/approve/transaction', {
    tokenAddress: resolved,
    amount: amount || undefined, // omit for unlimited approval
  })

  // Execute the approval via the bridge
  const receipt = await bridge.chain(
    bridgeNetwork,
    'send-transaction',
    {
      to: result.to,
      data: result.data,
      value: result.value || '0',
      rpcUrl,
    },
    bridgeNetwork,
  )

  return {
    txHash: receipt?.txHash || receipt?.tx_hash || String(receipt),
    chain,
    token: resolved,
    amount: amount || 'unlimited',
  }
}

/**
 * Execute a token swap via 1inch.
 *
 * Auto-approves if the source token doesn't have sufficient allowance.
 */
export async function swap(
  apiKey,
  chain,
  { src, dst, amount, slippage = 1, from, receiver, rpcUrl },
) {
  if (!src) throw new DexError('MISSING_TOKEN', 'src token is required')
  if (!dst) throw new DexError('MISSING_TOKEN', 'dst token is required')
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    throw new DexError('INVALID_AMOUNT', 'amount must be a positive number')
  }
  if (!from) throw new DexError('MISSING_FROM', 'from address is required')
  if (slippage != null && (Number(slippage) < 0 || Number(slippage) > 50)) {
    throw new DexError('INVALID_SLIPPAGE', 'slippage must be between 0 and 50')
  }

  const { chainId, bridgeNetwork } = resolveChain(chain)
  const srcToken = resolveToken(src)
  const dstToken = resolveToken(dst)
  if (srcToken !== NATIVE_TOKEN) validateAddress(srcToken, 'src token')
  if (dstToken !== NATIVE_TOKEN) validateAddress(dstToken, 'dst token')
  validateAddress(from, 'from')
  if (receiver) validateAddress(receiver, 'receiver')

  // Auto-approve if needed (skip for native token swaps).
  // Approves the exact swap amount rather than unlimited to limit exposure
  // if the router contract is compromised.
  if (srcToken !== NATIVE_TOKEN) {
    const allowance = await apiCall(apiKey, chainId, '/approve/allowance', {
      tokenAddress: srcToken,
      walletAddress: from,
    })

    if (BigInt(allowance.allowance) < BigInt(amount)) {
      const approveTx = await apiCall(apiKey, chainId, '/approve/transaction', {
        tokenAddress: srcToken,
        amount, // exact-amount approval — intentional, see comment above
      })

      await bridge.chain(
        bridgeNetwork,
        'send-transaction',
        {
          to: approveTx.to,
          data: approveTx.data,
          value: approveTx.value || '0',
          rpcUrl,
        },
        bridgeNetwork,
      )
    }
  }

  // Get the swap calldata
  const result = await apiCall(apiKey, chainId, '/swap', {
    src: srcToken,
    dst: dstToken,
    amount,
    from,
    slippage,
    receiver: receiver || undefined,
    disableEstimate: false,
    includeTokensInfo: true,
  })

  if (!result.tx) {
    throw new DexError('SWAP_FAILED', 'No transaction data returned from 1inch')
  }

  // Execute the swap via the bridge
  const receipt = await bridge.chain(
    bridgeNetwork,
    'send-transaction',
    {
      to: result.tx.to,
      data: result.tx.data,
      value: result.tx.value || '0',
      gas: String(result.tx.gas),
      rpcUrl,
    },
    bridgeNetwork,
  )

  return {
    txHash: receipt?.txHash || receipt?.tx_hash || String(receipt),
    chain,
    srcToken: result.srcToken?.symbol ?? src,
    dstToken: result.dstToken?.symbol ?? dst,
    srcAmount: amount,
    dstAmount: String(result.dstAmount),
  }
}
