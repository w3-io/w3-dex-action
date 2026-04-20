/**
 * DEX action unit tests.
 *
 * Mocks `request` (HTTP) and `bridge.chain` (signing) from action-core
 * so every test runs without network calls.
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'

// ── Shared mock state ─────────────────────────────────────────────

let requestFn = mock.fn()
let bridgeChainFn = mock.fn()
let bridgeCalls = []

// Mock the entire action-core module before dex.js is loaded
mock.module('@w3-io/action-core', {
  namedExports: {
    W3ActionError: (await import('@w3-io/action-core')).W3ActionError,
    request: (...args) => requestFn(...args),
    bridge: {
      chain: (...args) => {
        bridgeCalls.push(args)
        return bridgeChainFn(...args)
      },
    },
  },
})

// Now import the code under test — it will bind to the mocked module
const { quote, swap, checkAllowance, listTokens, DexError } = await import('../src/dex.js')

const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
const VALID_ADDR_A = '0x6B175474E89094C44Da98b954EedeAC495271d0F' // DAI
const VALID_ADDR_B = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' // USDC
const VALID_WALLET = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'

beforeEach(() => {
  bridgeCalls = []
  requestFn = mock.fn()
  bridgeChainFn = mock.fn(() => Promise.resolve({ txHash: '0xabc123' }))
})

function mockRequestResponse(response) {
  requestFn = mock.fn(() => Promise.resolve(response))
}

// ── resolveChain ──────────────────────────────────────────────────

describe('resolveChain', () => {
  it('throws UNSUPPORTED_CHAIN for unknown chains', async () => {
    await assert.rejects(
      () =>
        quote('key', 'solana', {
          src: VALID_ADDR_A,
          dst: VALID_ADDR_B,
          amount: '100',
        }),
      (err) => err instanceof DexError && err.code === 'UNSUPPORTED_CHAIN',
    )
  })
})

// ── Amount validation ─────────────────────────────────────────────

describe('amount validation', () => {
  it('quote() rejects non-numeric amount "abc"', async () => {
    await assert.rejects(
      () =>
        quote('key', 'ethereum', {
          src: VALID_ADDR_A,
          dst: VALID_ADDR_B,
          amount: 'abc',
        }),
      (err) => err instanceof DexError && err.code === 'INVALID_AMOUNT',
    )
  })

  it('quote() rejects zero amount', async () => {
    await assert.rejects(
      () =>
        quote('key', 'ethereum', {
          src: VALID_ADDR_A,
          dst: VALID_ADDR_B,
          amount: '0',
        }),
      (err) => err instanceof DexError && err.code === 'INVALID_AMOUNT',
    )
  })

  it('quote() rejects negative amount', async () => {
    await assert.rejects(
      () =>
        quote('key', 'ethereum', {
          src: VALID_ADDR_A,
          dst: VALID_ADDR_B,
          amount: '-1',
        }),
      (err) => err instanceof DexError && err.code === 'INVALID_AMOUNT',
    )
  })

  it('quote() rejects empty amount', async () => {
    await assert.rejects(
      () =>
        quote('key', 'ethereum', {
          src: VALID_ADDR_A,
          dst: VALID_ADDR_B,
          amount: '',
        }),
      (err) => err instanceof DexError && err.code === 'INVALID_AMOUNT',
    )
  })

  it('swap() rejects non-numeric amount "abc"', async () => {
    await assert.rejects(
      () =>
        swap('key', 'ethereum', {
          src: VALID_ADDR_A,
          dst: VALID_ADDR_B,
          amount: 'abc',
          from: VALID_WALLET,
        }),
      (err) => err instanceof DexError && err.code === 'INVALID_AMOUNT',
    )
  })

  it('swap() rejects zero amount', async () => {
    await assert.rejects(
      () =>
        swap('key', 'ethereum', {
          src: VALID_ADDR_A,
          dst: VALID_ADDR_B,
          amount: '0',
          from: VALID_WALLET,
        }),
      (err) => err instanceof DexError && err.code === 'INVALID_AMOUNT',
    )
  })

  it('swap() rejects negative amount', async () => {
    await assert.rejects(
      () =>
        swap('key', 'ethereum', {
          src: VALID_ADDR_A,
          dst: VALID_ADDR_B,
          amount: '-1',
          from: VALID_WALLET,
        }),
      (err) => err instanceof DexError && err.code === 'INVALID_AMOUNT',
    )
  })
})

// ── Address validation ────────────────────────────────────────────

describe('address validation', () => {
  it('quote() rejects invalid src address "0xBAD"', async () => {
    await assert.rejects(
      () =>
        quote('key', 'ethereum', {
          src: '0xBAD',
          dst: VALID_ADDR_B,
          amount: '100',
        }),
      (err) => err instanceof DexError && err.code === 'INVALID_ADDRESS',
    )
  })

  it('quote() rejects invalid dst address', async () => {
    await assert.rejects(
      () =>
        quote('key', 'ethereum', {
          src: VALID_ADDR_A,
          dst: 'not-an-address',
          amount: '100',
        }),
      (err) => err instanceof DexError && err.code === 'INVALID_ADDRESS',
    )
  })

  it('quote() does NOT reject NATIVE_TOKEN as src', async () => {
    mockRequestResponse({
      dstAmount: '1000',
      gas: '21000',
      srcToken: { symbol: 'ETH' },
      dstToken: { symbol: 'USDC' },
    })

    const result = await quote('key', 'ethereum', {
      src: NATIVE_TOKEN,
      dst: VALID_ADDR_B,
      amount: '100',
    })
    assert.equal(result.srcToken, 'ETH')
  })

  it('quote() does NOT reject NATIVE_TOKEN as dst', async () => {
    mockRequestResponse({
      dstAmount: '500',
      gas: '21000',
      srcToken: { symbol: 'DAI' },
      dstToken: { symbol: 'ETH' },
    })

    const result = await quote('key', 'ethereum', {
      src: VALID_ADDR_A,
      dst: NATIVE_TOKEN,
      amount: '100',
    })
    assert.equal(result.dstToken, 'ETH')
  })
})

// ── Slippage validation ───────────────────────────────────────────

describe('slippage validation', () => {
  it('swap() rejects slippage > 50', async () => {
    await assert.rejects(
      () =>
        swap('key', 'ethereum', {
          src: VALID_ADDR_A,
          dst: VALID_ADDR_B,
          amount: '100',
          from: VALID_WALLET,
          slippage: 51,
        }),
      (err) => err instanceof DexError && err.code === 'INVALID_SLIPPAGE',
    )
  })

  it('swap() rejects slippage < 0', async () => {
    await assert.rejects(
      () =>
        swap('key', 'ethereum', {
          src: VALID_ADDR_A,
          dst: VALID_ADDR_B,
          amount: '100',
          from: VALID_WALLET,
          slippage: -1,
        }),
      (err) => err instanceof DexError && err.code === 'INVALID_SLIPPAGE',
    )
  })
})

// ── Bridge chain routing ──────────────────────────────────────────

describe('bridge chain routing', () => {
  it('swap() passes correct bridgeNetwork for polygon', async () => {
    // Use native token as src so no allowance check is needed
    mockRequestResponse({
      tx: {
        to: '0xrouter',
        data: '0xcalldata',
        value: '0',
        gas: '200000',
      },
      dstAmount: '999',
      srcToken: { symbol: 'MATIC' },
      dstToken: { symbol: 'USDC' },
    })

    await swap('key', 'polygon', {
      src: 'NATIVE',
      dst: VALID_ADDR_B,
      amount: '100',
      from: VALID_WALLET,
    })

    // bridge.chain should have been called with 'polygon' as the chain
    assert.equal(bridgeCalls.length, 1)
    assert.equal(bridgeCalls[0][0], 'polygon') // chainName
    assert.equal(bridgeCalls[0][1], 'send-transaction') // action
    assert.equal(bridgeCalls[0][3], 'polygon') // network param
  })

  it('swap() passes correct bridgeNetwork for ethereum', async () => {
    mockRequestResponse({
      tx: {
        to: '0xrouter',
        data: '0xcalldata',
        value: '0',
        gas: '200000',
      },
      dstAmount: '999',
      srcToken: { symbol: 'ETH' },
      dstToken: { symbol: 'USDC' },
    })

    await swap('key', 'ethereum', {
      src: 'NATIVE',
      dst: VALID_ADDR_B,
      amount: '100',
      from: VALID_WALLET,
    })

    assert.equal(bridgeCalls.length, 1)
    assert.equal(bridgeCalls[0][0], 'ethereum')
    assert.equal(bridgeCalls[0][3], 'ethereum')
  })

  it('swap() passes correct bridgeNetwork for arbitrum', async () => {
    mockRequestResponse({
      tx: {
        to: '0xrouter',
        data: '0xcalldata',
        value: '0',
        gas: '200000',
      },
      dstAmount: '999',
      srcToken: { symbol: 'ETH' },
      dstToken: { symbol: 'USDC' },
    })

    await swap('key', 'arbitrum', {
      src: 'NATIVE',
      dst: VALID_ADDR_B,
      amount: '100',
      from: VALID_WALLET,
    })

    assert.equal(bridgeCalls.length, 1)
    assert.equal(bridgeCalls[0][0], 'arbitrum')
    assert.equal(bridgeCalls[0][3], 'arbitrum')
  })
})

// ── quote() happy path ────────────────────────────────────────────

describe('quote() happy path', () => {
  it('returns expected shape from API response', async () => {
    mockRequestResponse({
      dstAmount: '1500000000',
      gas: '150000',
      srcToken: { symbol: 'DAI' },
      dstToken: { symbol: 'USDC' },
    })

    const result = await quote('key', 'ethereum', {
      src: VALID_ADDR_A,
      dst: VALID_ADDR_B,
      amount: '1000000000000000000',
    })

    assert.equal(result.chain, 'ethereum')
    assert.equal(result.srcToken, 'DAI')
    assert.equal(result.dstToken, 'USDC')
    assert.equal(result.srcAmount, '1000000000000000000')
    assert.equal(result.dstAmount, '1500000000')
    assert.equal(result.estimatedGas, '150000')
  })

  it('falls back to input addresses when API omits token info', async () => {
    mockRequestResponse({
      dstAmount: '500',
      gas: null,
    })

    const result = await quote('key', 'ethereum', {
      src: VALID_ADDR_A,
      dst: VALID_ADDR_B,
      amount: '100',
    })

    assert.equal(result.srcToken, VALID_ADDR_A)
    assert.equal(result.dstToken, VALID_ADDR_B)
    assert.equal(result.estimatedGas, '0')
  })
})

// ── listTokens() happy path ──────────────────────────────────────

describe('listTokens() happy path', () => {
  it('returns mapped tokens from API response', async () => {
    mockRequestResponse({
      tokens: {
        '0xaaa': {
          symbol: 'AAA',
          name: 'Token A',
          address: '0xaaa',
          decimals: 18,
          extra: 'ignored',
        },
        '0xbbb': {
          symbol: 'BBB',
          name: 'Token B',
          address: '0xbbb',
          decimals: 6,
        },
      },
    })

    const result = await listTokens('key', 'ethereum')

    assert.equal(result.chain, 'ethereum')
    assert.equal(result.count, 2)
    assert.equal(result.tokens.length, 2)
    assert.deepEqual(result.tokens[0], {
      symbol: 'AAA',
      name: 'Token A',
      address: '0xaaa',
      decimals: 18,
    })
    // Verify extra fields are stripped
    assert.equal(result.tokens[0].extra, undefined)
  })

  it('handles empty token list', async () => {
    mockRequestResponse({ tokens: {} })

    const result = await listTokens('key', 'ethereum')
    assert.equal(result.count, 0)
    assert.deepEqual(result.tokens, [])
  })
})

// ── resolveToken() ────────────────────────────────────────────────

describe('resolveToken (via quote)', () => {
  it('"ETH" resolves to NATIVE_TOKEN and is accepted', async () => {
    mockRequestResponse({
      dstAmount: '100',
      gas: '21000',
      srcToken: { symbol: 'ETH' },
      dstToken: { symbol: 'USDC' },
    })

    const result = await quote('key', 'ethereum', {
      src: 'ETH',
      dst: VALID_ADDR_B,
      amount: '100',
    })
    assert.equal(result.srcToken, 'ETH')
  })

  it('"eth" (lowercase) resolves to NATIVE_TOKEN', async () => {
    mockRequestResponse({
      dstAmount: '100',
      gas: '21000',
      srcToken: { symbol: 'ETH' },
      dstToken: { symbol: 'USDC' },
    })

    const result = await quote('key', 'ethereum', {
      src: 'eth',
      dst: VALID_ADDR_B,
      amount: '100',
    })
    assert.equal(result.srcToken, 'ETH')
  })

  it('"NATIVE" resolves to NATIVE_TOKEN', async () => {
    mockRequestResponse({
      dstAmount: '100',
      gas: '21000',
      srcToken: { symbol: 'ETH' },
      dstToken: { symbol: 'USDC' },
    })

    const result = await quote('key', 'ethereum', {
      src: 'NATIVE',
      dst: VALID_ADDR_B,
      amount: '100',
    })
    assert.equal(result.srcToken, 'ETH')
  })
})

// ── checkAllowance() happy path ───────────────────────────────────

describe('checkAllowance() happy path', () => {
  it('returns allowance from API response', async () => {
    mockRequestResponse({ allowance: '1000000000000000000' })

    const result = await checkAllowance('key', 'ethereum', {
      token: VALID_ADDR_A,
      wallet: VALID_WALLET,
    })

    assert.equal(result.chain, 'ethereum')
    assert.equal(result.token, VALID_ADDR_A)
    assert.equal(result.wallet, VALID_WALLET)
    assert.equal(result.allowance, '1000000000000000000')
  })
})

// ── Existing error path tests ─────────────────────────────────────

describe('quote error paths', () => {
  it('throws MISSING_TOKEN when src is empty', async () => {
    await assert.rejects(
      () =>
        quote('key', 'ethereum', {
          src: '',
          dst: VALID_ADDR_B,
          amount: '100',
        }),
      (err) => err instanceof DexError && err.code === 'MISSING_TOKEN',
    )
  })
})

describe('checkAllowance error paths', () => {
  it('throws MISSING_WALLET when wallet is empty', async () => {
    await assert.rejects(
      () => checkAllowance('key', 'ethereum', { token: VALID_ADDR_A, wallet: '' }),
      (err) => err instanceof DexError && err.code === 'MISSING_WALLET',
    )
  })
})
