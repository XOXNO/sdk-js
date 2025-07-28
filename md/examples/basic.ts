import { getSdk } from './get-sdk'

async function main() {
  /* Calling public endpoints ✅ */

  const trendingCollections = await getSdk().collection.query({
    filter: {
      top: 10,
      orderBy: ['statistics.tradeData.weekEgldVolume desc'],
      filters: {
        isVerified: true,
      },
    },
  })

  console.log(trendingCollections.resources) // CollectionProfileDoc[]

  const collectionProfile = await getSdk()
    .collection.collection('BOOGAS-afc98d')
    .profile()

  console.log(collectionProfile.description) // string

  // ... and many more!
}

main()
