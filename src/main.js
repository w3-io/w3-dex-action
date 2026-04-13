import * as core from '@actions/core'
import { createCommandRouter, setJsonOutput, handleError } from '@w3-io/action-core'
import { quote, swap, approve, checkAllowance, listTokens, DexError } from './dex.js'

/**
 * W3 DEX Action — token swaps via 1inch aggregation.
 *
 * Routes through 100+ DEXes for best execution price.
 * Uses the 1inch API for routing and the W3 bridge for signing.
 */

function apiKey() {
  const key = core.getInput('api-key', { required: true })
  if (!key) throw new DexError('MISSING_API_KEY', 'api-key is required')
  return key
}

const handlers = {
  quote: async () => {
    const result = await quote(apiKey(), core.getInput('chain', { required: true }), {
      src: core.getInput('src', { required: true }),
      dst: core.getInput('dst', { required: true }),
      amount: core.getInput('amount', { required: true }),
    })
    setJsonOutput('result', result)
  },

  swap: async () => {
    const result = await swap(apiKey(), core.getInput('chain', { required: true }), {
      src: core.getInput('src', { required: true }),
      dst: core.getInput('dst', { required: true }),
      amount: core.getInput('amount', { required: true }),
      slippage: Number(core.getInput('slippage')) || 1,
      from: core.getInput('from', { required: true }),
      receiver: core.getInput('receiver') || undefined,
      rpcUrl: core.getInput('rpc-url') || undefined,
    })
    setJsonOutput('result', result)
  },

  approve: async () => {
    const result = await approve(apiKey(), core.getInput('chain', { required: true }), {
      token: core.getInput('token', { required: true }),
      amount: core.getInput('amount') || undefined,
      rpcUrl: core.getInput('rpc-url') || undefined,
    })
    setJsonOutput('result', result)
  },

  'check-allowance': async () => {
    const result = await checkAllowance(
      apiKey(),
      core.getInput('chain', { required: true }),
      {
        token: core.getInput('token', { required: true }),
        wallet: core.getInput('wallet', { required: true }),
      },
    )
    setJsonOutput('result', result)
  },

  'list-tokens': async () => {
    const result = await listTokens(apiKey(), core.getInput('chain', { required: true }))
    setJsonOutput('result', result)
  },
}

const router = createCommandRouter(handlers)

export async function run() {
  try {
    await router()
  } catch (error) {
    if (error instanceof DexError) {
      core.setFailed(`DEX error (${error.code}): ${error.message}`)
    } else {
      handleError(error)
    }
  }
}
