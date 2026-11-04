// Run after building the SDK: node examples/stellar-referral-swap.mjs
import assert from 'node:assert/strict'
import { Asset, Networks, StrKey, Transaction, scValToNative } from '@stellar/stellar-sdk'
import {
  buildStellarExecuteStrategyTx,
  decodeStellarRouteBytes,
  getStellarAggregatorQuote,
  mapQuoteResponseToStrategySwap,
} from '@xoxno/sdk-js'

const baseUrl = 'https://stellar-swap.xoxno.com'
const referralId = 1
const [config, referral] = await Promise.all(
  ['/api/v1/config', `/api/v1/referrals/${referralId}`].map(async path => {
    const response = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(30_000) })
    assert.ok(response.ok, `${path}: HTTP ${response.status}`)
    return response.json()
  })
)
assert.equal(config.network, 'mainnet')
assert.equal(config.networkPassphrase, Networks.PUBLIC)
assert.equal(referral.id, String(referralId))
assert.equal(referral.active, true, 'Referral must be active')

const request = {
  from: Asset.native().contractId(Networks.PUBLIC),
  to: new Asset('USDC', 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN').contractId(Networks.PUBLIC),
  amountIn: '100000000', // 10 XLM, seven decimals.
  slippage: 0.01,
  platform: 'aggregator',
  referralId,
  fresh: true,
}
const quote = await getStellarAggregatorQuote(request, {
  baseUrl,
  fetchOptions: { signal: AbortSignal.timeout(30_000) },
})
assert.ok(quote.routeXdr, 'Quote must include executable route bytes')
assert.equal(quote.amountIn, request.amountIn)
assert.equal(quote.feeBps, referral.totalFeeBps)
const swap = mapQuoteResponseToStrategySwap(quote, {
  network: config.network,
  expected: { tokenIn: request.from, tokenOut: request.to, amountIn: request.amountIn, minOut: quote.amountOutMin },
})
assert.equal(decodeStellarRouteBytes(swap).referralId, referralId)

// Dummy account: build only; no RPC preparation, signing or submission.
const built = buildStellarExecuteStrategyTx({
  network: config.network,
  caller: StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 1)),
  sourceSequence: '0',
  routerAddress: config.router,
  totalIn: quote.amountIn,
}, swap)
const transaction = new Transaction(built.xdr, Networks.PUBLIC)
assert.equal(transaction.signatures.length, 0)
assert.equal(transaction.operations.length, 1)
const invocation = transaction.operations[0].func.invokeContract()
assert.equal(invocation.functionName().toString(), 'execute_strategy')
const args = invocation.args()
assert.equal(scValToNative(args[1]), BigInt(request.amountIn))
const embeddedRoute = scValToNative(args[2])
assert.deepEqual(embeddedRoute, Buffer.from(quote.routeXdr, 'base64'))
assert.equal(decodeStellarRouteBytes(embeddedRoute).referralId, referralId)

console.log(JSON.stringify({
  network: config.network,
  inputXlm: quote.amountInShort,
  estimatedUsdc: quote.amountOutShort,
  minimumUsdc: quote.amountOutMinShort,
  slippagePercent: request.slippage * 100,
  referralId,
  referralFeeBps: referral.referralFeeBps,
  protocolFeeBps: referral.staticFeeBps,
  totalFeeBps: quote.feeBps,
  fee: `${quote.feeAmountShort} ${quote.feeOnInput ? 'XLM' : 'USDC'}`,
  ledger: quote.snapshot?.ledger,
  checks: 'Quote and unsigned transaction both encode referral 1; route bytes unchanged',
  submitted: false,
}, null, 2))
