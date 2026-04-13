/**
 * DEX action unit tests.
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { quote, checkAllowance, DexError } from '../src/dex.js'

// Mock the request function from action-core
import { bridge } from '@w3-io/action-core'

let originalChain
let bridgeCalls

beforeEach(() => {
  originalChain = bridge.chain
  bridgeCalls = []
})

afterEach(() => {
  bridge.chain = originalChain
})

describe('resolveChain', () => {
  it('throws UNSUPPORTED_CHAIN for unknown chains', async () => {
    await assert.rejects(
      () => quote('key', 'solana', { src: '0x1', dst: '0x2', amount: '100' }),
      (err) => err instanceof DexError && err.code === 'UNSUPPORTED_CHAIN',
    )
  })
})

describe('quote', () => {
  it('throws MISSING_TOKEN when src is empty', async () => {
    await assert.rejects(
      () => quote('key', 'ethereum', { src: '', dst: '0x2', amount: '100' }),
      (err) => err instanceof DexError && err.code === 'MISSING_TOKEN',
    )
  })

  it('throws MISSING_AMOUNT when amount is empty', async () => {
    await assert.rejects(
      () => quote('key', 'ethereum', { src: '0x1', dst: '0x2', amount: '' }),
      (err) => err instanceof DexError && err.code === 'MISSING_AMOUNT',
    )
  })
})

describe('checkAllowance', () => {
  it('throws MISSING_WALLET when wallet is empty', async () => {
    await assert.rejects(
      () => checkAllowance('key', 'ethereum', { token: '0x1', wallet: '' }),
      (err) => err instanceof DexError && err.code === 'MISSING_WALLET',
    )
  })
})
