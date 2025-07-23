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

  // ... and many more! Just call sdk. and you will get type support
}

main()
