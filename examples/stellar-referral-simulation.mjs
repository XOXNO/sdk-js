// Run after building: node examples/stellar-referral-simulation.mjs
// Read-only simulation. No signing or submission.
import assert from 'node:assert/strict'
import { Address, Asset, Networks, StrKey, Transaction, rpc, scValToNative, xdr } from '@stellar/stellar-sdk'
import { buildStellarExecuteStrategyTx, decodeStellarRouteBytes, getStellarAggregatorQuote, mapQuoteResponseToStrategySwap } from '@xoxno/sdk-js'

const baseUrl = 'https://stellar-swap.xoxno.com'
const rpcUrl = 'https://stellar-gateway.xoxno.com'
const router = 'CCVENFSVCBYDHVOACFZXMNNYVOZ3LKXPZYU5LUI4N7KTXOKRVYD7F3TR'
const sender = 'GAVWFZK5BGCGBWH4O2CXAHXVRIYVAMGCTZJ24IPLVNLT2WQ2LJBDEEBP'
const usdcIssuer = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
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
assert.equal(config.router, router)
assert.equal(referral.id, String(referralId))
assert.equal(referral.active, true)

const request = {
  from: Asset.native().contractId(Networks.PUBLIC),
  to: new Asset('USDC', usdcIssuer).contractId(Networks.PUBLIC),
  amountIn: '100000000', // 10 XLM.
  slippage: 0.01,
  platform: 'aggregator',
  referralId,
  sender,
  simulate: false, // Simulate the SDK-built transaction below to retain state diffs.
  fresh: true,
  maxHops: 1,
  maxSplits: 1,
}
const quote = await getStellarAggregatorQuote(request, {
  baseUrl, fetchOptions: { signal: AbortSignal.timeout(30_000) },
})
assert.ok(quote.routeXdr)
assert.equal(quote.amountIn, request.amountIn)
assert.equal(quote.feeBps, referral.totalFeeBps)
assert.equal(quote.feeOnInput, true)
assert.equal(BigInt(quote.amountOutMin), BigInt(quote.amountOut) * 99n / 100n)
const swap = mapQuoteResponseToStrategySwap(quote, {
  network: config.network,
  expected: { tokenIn: request.from, tokenOut: request.to, amountIn: request.amountIn, minOut: quote.amountOutMin },
})
const route = decodeStellarRouteBytes(swap)
assert.equal(route.referralId, referralId)
assert.equal(route.ops.length, 1)
assert.equal(route.ops[0].kind, 'swap')

const server = new rpc.Server(rpcUrl)
const account = await server.getAccount(sender)
const built = buildStellarExecuteStrategyTx({
  network: config.network, caller: sender, sourceSequence: account.sequenceNumber(),
  routerAddress: config.router, totalIn: quote.amountIn,
}, swap)
const transaction = new Transaction(built.xdr, Networks.PUBLIC)
assert.equal(transaction.signatures.length, 0)
assert.equal(transaction.source, sender)
assert.equal(transaction.operations.length, 1)
const invocation = transaction.operations[0].func.invokeContract()
assert.equal(invocation.functionName().toString(), 'execute_strategy')
assert.equal(Address.fromScAddress(invocation.contractAddress()).toString(), router)
const args = invocation.args()
assert.equal(args.length, 3)
assert.equal(scValToNative(args[0]), sender)
assert.equal(scValToNative(args[1]), BigInt(request.amountIn))
assert.deepEqual(scValToNative(args[2]), Buffer.from(quote.routeXdr, 'base64'))

const response = await fetch(rpcUrl, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'simulateTransaction', params: { transaction: built.xdr, authMode: 'record' } }),
  signal: AbortSignal.timeout(45_000),
})
assert.ok(response.ok, `RPC HTTP ${response.status}`)
const raw = await response.json()
assert.equal(raw.error, undefined, JSON.stringify(raw.error))
const simulation = raw.result
assert.equal(simulation.error, undefined, simulation.error)
assert.equal(simulation.restorePreamble, undefined, 'Ledger restoration required')
assert.equal(simulation.results?.length, 1)
assert.ok(simulation.stateChanges?.length, 'RPC must return state diffs')

function decodeEntry(encoded) {
  if (!encoded) return null
  const data = xdr.LedgerEntry.fromXDR(encoded, 'base64').data()
  const type = data.switch().name
  if (type === 'contractData') {
    const entry = data.contractData()
    return { type, contract: Address.fromScAddress(entry.contract()).toString(), key: scValToNative(entry.key()), value: scValToNative(entry.val()) }
  }
  if (type === 'account') {
    const entry = data.account()
    return { type, owner: StrKey.encodeEd25519PublicKey(entry.accountId().ed25519()), balance: BigInt(entry.balance().toString()) }
  }
  if (type === 'trustline') {
    const entry = data.trustLine()
    assert.equal(entry.asset().switch().name, 'assetTypeCreditAlphanum4')
    const asset = entry.asset().alphaNum4()
    return { type, owner: StrKey.encodeEd25519PublicKey(entry.accountId().ed25519()), asset: asset.assetCode().toString().replaceAll('\0', ''), issuer: StrKey.encodeEd25519PublicKey(asset.issuer().ed25519()), balance: BigInt(entry.balance().toString()) }
  }
  return { type }
}
const json = value => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v)
const changes = simulation.stateChanges.map(change => ({ type: change.type, before: decodeEntry(change.before), after: decodeEntry(change.after) }))
const find = predicate => {
  const matches = changes.filter(change => predicate(change.after ?? change.before))
  assert.equal(matches.length, 1, 'Expected exactly one matching state change')
  return matches[0]
}
const contractState = (contract, key) => find(entry => entry.type === 'contractData' && entry.contract === contract && json(entry.key) === json(key))
const delta = change => (change.after?.balance ?? change.after?.value ?? 0n) - (change.before?.balance ?? change.before?.value ?? 0n)
const output = scValToNative(xdr.ScVal.fromXDR(simulation.results[0].xdr, 'base64'))
const input = BigInt(request.amountIn)
const adminFee = input * BigInt(referral.staticFeeBps) / 10000n
const referralFee = input * BigInt(referral.referralFeeBps) / 10000n
assert.equal(BigInt(quote.feeAmount), adminFee + referralFee)
assert.ok(output >= route.totalMinOut)
assert.equal(output, BigInt(quote.amountOut))
assert.equal(delta(find(entry => entry.type === 'account' && entry.owner === sender)), -input)
assert.equal(delta(find(entry => entry.type === 'trustline' && entry.owner === sender && entry.asset === 'USDC' && entry.issuer === usdcIssuer)), output)
assert.equal(delta(contractState(config.router, ['AdminFee', request.from])), adminFee)
assert.equal(delta(contractState(config.router, ['ReferralFee', String(referralId), request.from])), referralFee)
const reserved = contractState(config.router, ['ReservedTotal', request.from])
assert.equal(delta(reserved), adminFee + referralFee)
const routerXlm = contractState(request.from, ['Balance', config.router])
const routerUsdc = contractState(request.to, ['Balance', config.router])
assert.equal(routerXlm.after.value.amount - routerXlm.before.value.amount, adminFee + referralFee)
assert.equal(routerXlm.after.value.amount - (reserved.after?.value ?? 0n), routerXlm.before.value.amount - (reserved.before?.value ?? 0n))
assert.equal(routerUsdc.after.value.amount, routerUsdc.before.value.amount)
const routerBalanceWrites = changes.filter(change => {
  const entry = change.after ?? change.before
  return entry.type === 'contractData' && Array.isArray(entry.key) && entry.key[0] === 'Balance' && entry.key[1] === router
})
assert.deepEqual(routerBalanceWrites.map(change => (change.after ?? change.before).contract).sort(), [request.from, request.to].sort(), 'Unexpected router token balances')
const routerWrites = changes.filter(change => (change.after ?? change.before).type === 'contractData' && (change.after ?? change.before).contract === config.router)
assert.equal(routerWrites.length, 3, 'Unexpected router storage writes')

console.log(JSON.stringify({
  sender, network: config.network, ledger: simulation.latestLedger,
  inputXlmAtoms: input, outputUsdcAtoms: output, minimumUsdcAtoms: route.totalMinOut,
  venue: route.ops[0].venue, referralId, referralFeeXlmAtoms: referralFee, protocolFeeXlmAtoms: adminFee,
  routerXlmBefore: routerXlm.before.value.amount, routerXlmAfter: routerXlm.after.value.amount,
  routerUsdcBefore: routerUsdc.before.value.amount, routerUsdcAfter: routerUsdc.after.value.amount,
  unaccountedDustDelta: 0, minResourceFeeStroops: simulation.minResourceFee,
  checks: 'Exact fee storage credits, user payout, minimum output, route preservation and no unaccounted dust passed',
  submitted: false, changes,
  request, config, quote, unsignedXdr: built.xdr, rawSimulation: simulation,
}, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2))
