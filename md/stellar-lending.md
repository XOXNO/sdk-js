# Stellar lending integration

Use `@xoxno/sdk-js/stellar-lending` for typed market and portfolio reads and
unsigned Soroban lending builders. Install the host Stellar SDK as well:

```sh
npm install @xoxno/sdk-js @stellar/stellar-sdk
```

The [checked application example](https://github.com/XOXNO/sdk-js/blob/alpha/examples/stellar-lending.ts)
contains discovery, supply preparation, wallet signing, submission and confirmation.
It performs no requests or transactions on import. Adapt its wallet callback to
your wallet SDK. This SDK never stores private keys.

## Choose one Stellar deployment

The SDK exports XOXNO's canonical Stellar deployment manifest. Select an entry
by network and use its RPC, quote-server and contract IDs together:

```ts
import {
  STELLAR_NETWORKS,
  XOXNOClient,
  stellarLendingRead,
} from '@xoxno/sdk-js/stellar-lending'

const deployment = STELLAR_NETWORKS.stellarTestnet
const read = stellarLendingRead(new XOXNOClient({ apiUrl }))
const rpcUrl = deployment.sorobanRpcUrl
const controllerAddress = deployment.lendingController
```

`XOXNOClient.apiUrl` is still supplied by your application. `network` selects
the Stellar signing domain for builders; pass the selected deployment's
`controllerAddress`, `governanceAddress` or `routerAddress` where required.
The SDK has no environment-variable or runtime endpoint discovery.

## List markets and positions

```ts
import { XOXNOClient, stellarLendingRead } from '@xoxno/sdk-js/stellar-lending'

const read = stellarLendingRead(new XOXNOClient({ apiUrl }))
const context = await read.context()
const reserves = await read.reserves({ spokeId: selectedSpokeId })
const depositMarkets = await read.assetMarkets(asset, 'deposit')
const detail = await read.reserve(spokeId, hubId, asset)
const portfolio = await read.userPositions(walletAddress)
```

Variables such as `apiUrl`, `asset` and selected IDs come from your application.
`context()` batches assets, hubs, spokes, reserves and detailed reserve data.
Use its ``reserveDetailsByKey[`${spokeId}:${hubId}:${asset}`]`` for list screens,
then refresh the selected reserve before an action.

A reserve is **(spokeId, hubId, asset)**. The hub supplies liquidity; the spoke
defines risk. The same token can have different risk settings across spokes and
different liquidity across hubs. Preserve all three coordinates in selections.
`paused`, `frozen`, `isBorrowable`, `isCollateralizable`, capacity and available
liquidity inform the interface. Simulation checks whether the current action can execute.

`userPositions(owner)` reads all positions for a wallet. `accountPositions(id)`
reads one lending account. `userHistory(id, query)` also takes a lending account
ID despite the URL's `/users/` segment. IDs arrive as decimal strings; pass
them directly as builder `accountNonce`. That name refers to a lending account,
not the Stellar transaction sequence. An account can contain several position rows.

The generated facade is also available from the package root:

```ts
import { buildSdk, XOXNOClient } from '@xoxno/sdk-js'
const sdk = buildSdk(new XOXNOClient({ apiUrl }))
const reserves = await sdk.stellarLending.reserves({ spokeId, signal })
const holders = await sdk.stellarLending.hubs.hubId(String(hubId)).holders({ side: 'deposits' })
```

Both facades use the same generated response contracts. The standalone readers
also accept an optional final fetch-options argument. Pass cancellation through
`signal`; undefined filters are omitted. Cursors are opaque query values: pass
the returned `continuationToken` unchanged to the next request.

## Read surface

All paths below are under `/stellar-lending`. Factory names are callable through
`stellarLendingRead(client)`. Hover them in an editor for their precise input and output types.

| Purpose | Factory methods | HTTP routes |
| --- | --- | --- |
| Discovery | `context`, `liveState`, `marketsDetailed`, `assets`, `hubs`, `spokes`, `reserves` | `/context`, `/live-state`, `/markets/detailed`, `/assets`, `/hubs`, `/spokes`, `/reserves` |
| Market detail | `asset`, `hub`, `spoke`, `reserve`, `assetPage`, `assetMarkets` | `/assets/{asset}`, `/hubs/{hubId}`, `/spokes/{spokeId}`, `/reserves/{spokeId}/{hubId}/{asset}`, `/assets/{asset}/page`, `/assets/{asset}/markets` |
| Holders | `reserveHolders`, `hubHolders`, `spokeHolders`, `distribution` | `.../holders`, `/distribution` |
| Charts | `assetGraph`, `hubGraph`, `spokeGraph`, `reserveGraph`, `statsHistory` | `.../graph`, `/stats/history` |
| Portfolios | `userPositions`, `accountPositions`, `userHistory`, `positionsPnl`, `pnlByScope`, `positionsLeaderboard` | `/users/{owner}/positions`, `/accounts/{accountId}/positions`, `/users/{accountId}/history`, `/pnl`, `/pnl/scope`, `/positions` |
| Activity | `userActivity`, `userActivityPage`, `walletBalance` | `/users/{owner}/activity`, `/users/{owner}/activity/page`, `/users/{owner}/assets/{asset}/balance` |
| Protocol analytics | `revenue`, `feeRevenue`, `liquidations`, `volume`, `activeUsers`, `rateSpread`, `defillama`, `participants`, `liquidationsLeaderboard` | `/revenue`, `/revenue/fees`, `/liquidations`, `/volume`, `/active-users`, `/rate-spread`, `/defillama`, `/participants`, `/liquidations/leaderboard` |
| Governance and campaign | `governanceProposals`, `campaignLeaderboard`, `campaignMe` | `/governance/proposals`, `/campaign/leaderboard`, `/campaign/me` |

`walletBalance` and `userActivityPage` require the coordinated API release that
adds those two routes. Older deployments return 404. Balance is exact holdings,
which may exceed spendable funds. The legacy `userActivity` returns display
amounts; the new page returns exact amounts, transaction hashes and a cursor.

For external listing adapters, the generated facade also exposes
`sdk.integrations.lending.stellar()`, `.history()`, `.revenue()` and `.activeUsers()`
under `/integrations/lending/stellar`. These four exports have separate adapter
contracts; their APYs are fractions (`0.05` means 5%). Legacy `tvlUsd` represents
cash; use the explicit supplied/borrowed totals when displaying those quantities.

## Units and selectors

| Value | Meaning |
| --- | --- |
| Builder token amounts | Decimal integer strings in token base units: 1 token with 7 decimals = `"10000000"`. Use integer arithmetic, never floating-point conversion. |
| Position `supplyAmount`, `borrowAmount` | Token quantities scaled by RAY (`10^27`), **not base units**. Do not pass them directly to builders. |
| `supplyScaledRay`, `borrowScaledRay`, indexes | Exact RAY strings. Current position quantities apply indexes to scaled balances. |
| `*Wad` / raw USD price | WAD (`10^18`); keep exact arithmetic as strings or bigint. |
| `*Usd`, `*Native`, `*Short` | Display numbers; check each field's TypeDoc for units. |
| `*Bps` | Basis points: 10,000 = 100%. |
| Market `side` | `deposit` or `borrow`. |
| Holder-list `side` | `deposits` or `borrows`. |
| Distribution query / response `side` | Query: `deposits` or `borrows`; response: `supply` or `borrow`. |
| Chart query | ISO-8601 `from`/`to` and a Kusto `bin`, such as `1h` or `1d`. |

The leaderboard's `healthFactor` is debt divided by liquidation-weighted
collateral, times 100; higher is riskier. Do not apply the opposite convention
from other protocols. Use exact risk data and simulation for transaction decisions.

## Build, prepare, sign and confirm

```ts
import {
  buildStellarSupplyTx, prepareStellarBuiltTx,
} from '@xoxno/sdk-js/stellar-lending'
import { rpc } from '@stellar/stellar-sdk'

const server = new rpc.Server(rpcUrl)
const source = await server.getAccount(caller)
const built = buildStellarSupplyTx({
  network, controllerAddress, caller, sourceSequence: source.sequenceNumber(),
}, {
  spokeId, hubId, asset, amount: '10000000', accountNonce: '0',
})
const preparedXdr = await prepareStellarBuiltTx(server, built, { network })
// Wallet signs preparedXdr using STELLAR_NETWORK_PASSPHRASE[network].
// Parse that signed XDR with the same passphrase, then server.sendTransaction.
// Poll server.getTransaction(hash) until SUCCESS or FAILED.
```

Builders are synchronous and RPC-free. They return unsigned XDR with one
contract invocation. Preparation simulates and attaches the Soroban footprint,
authorization entries and resource fee; calling simulation alone does not mutate
the original envelope. Sign the **prepared** result. Default timeout is 300 seconds.
Fetch a fresh sequence immediately before building; serialize submissions from
the same wallet. Rebuild and prepare after expiry or a sequence change.

`PENDING` and `DUPLICATE` are not execution success. Persist the transaction hash,
poll with a bounded timeout, and refresh the portfolio after `SUCCESS`. If a
network call fails or confirmation times out, check that hash before building a
replacement. The checked example preserves it in recovery errors. Contract-account
authorization or multi-signer wallets may require additional host-side signing logic.

| User action | Builder |
| --- | --- |
| Supply / borrow / withdraw / repay | `buildStellarSupplyTx`, `buildStellarBorrowTx`, `buildStellarWithdrawTx`, `buildStellarRepayTx`; each also has a `BatchTx` form |
| Open or increase a strategy | `buildStellarMultiplyTx` |
| Change debt / collateral | `buildStellarSwapDebtTx`, `buildStellarSwapCollateralTx` |
| Repay from collateral | `buildStellarRepayDebtWithCollateralTx`; same-token repayment uses `buildSameTokenRepaySwapSteps()` |
| Migrate Blend | `buildStellarMigrateFromBlendTx` |
| Specialist operations | `buildStellarLiquidateTx`, `buildStellarFlashLoanTx`; generic `buildTx` accepts explicit ABI arguments |

Supply and multiply require a positive `spokeId`, including existing-account
top-ups. Omitted/zero `accountNonce` creates an account for these operations.
Withdraw amount `"0"` means the full supplied position. Borrow and repay require
an existing account. Preserve safe integer numbers or decimal strings for account
IDs; unsafe numbers are rejected before encoding.

Strategy builders take quote-server `routeXdr` as `steps`. Obtain it with
`getStellarAggregatorQuote`; exactly one of `amountIn` or `amountOut` is required.
Refresh the quote for changed amounts/slippage and preserve referral IDs.
Stellar position modes are 0 normal, 1 multiply, 2 long and 3 short.
Blend migration is a separate operation: explicit destination hub/spoke, approved
Blend pool, collateral/supply tokens and debt caps slightly above live debt.
It does not use aggregator routes.

## Migration and validation

This update requires `spokeId` in supply/multiply arguments and removes helpers
for API routes that do not exist: `protocolConfig`, `contractConfig`,
`contractRoles`, `accountDelegates`, `blendPools`, including their standalone
reader functions and phantom response types. Use deployed contract reads for
administrative state where needed. Other existing reader names remain available.

Response corrections may expose compile errors that previously hid a wire
mismatch: holders are under `holders[]`, leaderboard rows under `positions[]`,
USD totals are numbers, and spoke graphs contain supplied/borrowed USD points.
Prefer the response types exported from this SDK for these API calls.

After building, `npm run check:examples` checks ESM/CommonJS consumer declarations,
`npm run test:browser` checks the distributed Stellar bundle without Node globals,
and `npm run docs:stellar` generates searchable TypeDoc under `docs/stellar-lending`.
`build:sdk` regenerates from committed OpenAPI offline; `update:sdk` explicitly
refreshes the upstream spec. Local checks do not prove a deployed API or signed
transaction succeeds on either Stellar network.
