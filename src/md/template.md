# XOXNO SDK

## Basic usage

```typescript
// sdk.ts
import { buildSdk, Chain, XOXNOClient } from '../src'

// It's not expensive to build the sdk, so you can safely call `getSdk()` wherever you need it
export function getSdk() {
  XOXNOClient.init({ apiUrl: 'https://api.xoxno.com', chain: Chain.MAINNET })

  return buildSdk(XOXNOClient.getInstance())
}

async function main() {
  const sdk = getSdk()

  /* Calling public endpoints ✅ */

  const trendingCollections = await sdk.collection.query({
    filter: {
      top: 10,
      orderBy: ['statistics.tradeData.weekEgldVolume desc'],
      filters: {
        isVerified: true,
      },
    },
  })

  console.log(trendingCollections.resources) // CollectionProfileDoc[]

  const collectionProfile = await sdk.collection
    .collection('BOOGAS-afc98d')
    .profile()

  console.log(collectionProfile.description) // string

  // ... and many more!
}

main()
```

## Calling restricted endpoints

Apart from the public endpoints that anyone can call, The XOXNO SDK also exposes `POST`, `PUT`, `PATCH` and `DELETE` endpoints that can be called by the respective logged in user. Here's how a flow looks like that obtains a **XOXNO Auth Token** when logging in with a MultiversX wallet, that can be used for 24h to make authenticated requests:

```typescript
// native-auth.ts
import { getSdk } from './sdk'

export class NativeAuthClient {
  async initialize(extraInfo: object) {
    const token = await getSdk().user.nativeToken({
      originalUrl: 'https://yourdomain.com',
      extraInfo: JSON.stringify({
        ...extraInfo,
        timestamp: Date.now(),
        // ... and any other properties you want to have encoded in the JWT for your later usage
      }),
    })

    return { token }
  }
  getToken(address: string, token: string, signature: string) {
    const encodedAddress = this.encodeValue(address)

    const encodedToken = this.encodeValue(token)

    const loginToken = `${encodedAddress}.${encodedToken}.${signature}`

    return { loginToken }
  }
  private encodeValue(str: string) {
    return this.escape(Buffer.from(str, 'utf8').toString('base64'))
  }
  private escape(str: string) {
    return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }
}
```

```typescript
import { ExtensionProvider } from '@multiversx/sdk-extension-provider'
import { setCookie } from 'cookies-next'

import { NativeAuthClient } from './native-auth'
import { getSdk } from './sdk'

async function main() {
  const sdk = getSdk()

  const provider = ExtensionProvider.getInstance()

  await provider.init()

  const nativeAuthClient = new NativeAuthClient()

  const loginMethod = 'extension'

  const { token } = await nativeAuthClient.initialize({
    loginMethod,
  })

  const { address, signature } = await provider.login({ token })

  const { loginToken } = nativeAuthClient.getToken(address, token, signature!)

  const { access_token, expires } = await sdk.user.login.POST({
    body: {
      loginToken,
      signature: signature,
      address: address,
    },
  })

  // store the access_token for later usage
  setCookie('xoxno-auth', access_token, {
    expires: new Date(expires * 1000),
    sameSite: 'strict',
    secure: true,
  })

  // from now on you can call protected endpoints on behalf of `address`

  const newUserProfile = await sdk.user.address(address).profile.PATCH({
    body: {
      description: 'XOXNO SDK rocks!',
    },
    auth: access_token,
  })

  console.log(newUserProfile.description) // XOXNO SDK rocks!
}

main()
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
