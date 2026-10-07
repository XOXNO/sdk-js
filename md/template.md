# XOXNO SDK

## Installation

```bash
npm install @xoxno/sdk-js
```

## Basic usage

For render-ready Stellar lending data in browsers or React Native, use the
read subpath. It has no Stellar, MultiversX or Node runtime imports:

```typescript
import { createStellarLendingReadClient } from '@xoxno/sdk-js/stellar-lending/read'

const lending = createStellarLendingReadClient({ baseUrl: 'https://api.xoxno.com' })
const assets = await lending.assets({ usage: 'collateral' })
const positions = await lending.positions(owner)
```

`baseUrl` selects the API deployment, which must expose the new
`/stellar-lending/v1` read routes. Supply `fetch` if the host has no global
implementation. Both methods accept `signal`; positions follows every `Link`
page, including empty pages. APYs are fractions, raw amounts are exact integer
token base-unit strings, and unavailable data stays null. Capacities are indexed
estimates; prepare/simulate before signing. Public response types and inline
OpenAPI schemas are exported from the same subpath.

The Stellar peer is optional for REST reads. Install `@stellar/stellar-sdk`
when using transaction builders, RPC reads or swap decoders.

For Stellar lending, start with the [integration guide](md/stellar-lending.md)
and [checked example](examples/stellar-lending.ts). They cover typed market
discovery and unsigned XDR preparation, wallet signing, submission and confirmation.
Generate focused API documentation with `npm run docs:stellar`.
Decode direct XOXNO swap history synchronously with
`decodeStellarSwapEnvelope` from `@xoxno/sdk-js/stellar-swap`:

```typescript
import { decodeStellarSwapEnvelope } from '@xoxno/sdk-js/stellar-swap'

const swap = decodeStellarSwapEnvelope({
  envelopeXdr, networkPassphrase, routerAddress, viewer, operationIndex,
})
// swap: { tokenIn, tokenOut, amountInAtoms, operationIndex } | null
```

Pin `routerAddress` for the selected network. Fee bumps use inner operation
indices; omit the index only when there is one matching swap. The input amount
is an exact base-unit string. Actual output must come from ledger effects;
the route minimum is not the received amount. This decoder makes no network requests.

`XOXNOClient` requires an application-supplied `apiUrl`; the SDK does not read
environment variables or select an API deployment for you.
For Stellar infrastructure, use the exported `STELLAR_NETWORKS` manifest and
pass its selected RPC, quote-server and contract values to your host clients.

```typescript
$1
```

```typescript
$2
```

## Calling restricted endpoints

Apart from the public endpoints that anyone can call, The XOXNO SDK also exposes `POST`, `PUT`, `PATCH` and `DELETE` endpoints that can be called by the respective logged in user. Here's how a flow looks like that obtains a **XOXNO Auth Token** when logging in with a MultiversX wallet, that can be used for 24h to make authenticated requests:

```typescript
$3
```

```typescript
$4
```

## List of endpoints to call

The list of available SDK endpoints gets extracted from https://api.xoxno.com/swagger.yaml and parsed into a Typescript definition that you can [view here](https://github.com/XOXNO/sdk-js/blob/alpha/src/sdk/swagger.ts)

`buildSdk` then converts them in the following way:

```typescript
// /collection/:collection/profile
sdk.collection.collection('BOOGAS-afc98d').profile()

// /drops/:creatorTag/:collectionTag/drop-info
sdk.drops.creatorTag('MiceCityClub').collectionTag('MiceCity').dropInfo()
```

For your reference, here is a list of all endpoints that are available:

```typescript
$5
```
