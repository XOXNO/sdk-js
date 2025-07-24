# XOXNO SDK

## Installation

```bash
npm install @xoxno/sdk-js @xoxno/types
```

## Basic usage

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
