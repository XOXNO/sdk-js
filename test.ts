import { buildSdk, XOXNOClient } from './src/'
import { endpoints } from './src/sdk/swagger'
import { coveredMethods } from './src/sdk/utils'

async function _fn() {
  XOXNOClient.init()

  const entries = Object.entries(endpoints)

  const sdk = buildSdk(XOXNOClient.getInstance())

  console.log(
    /* entries
      .filter(([key, value]) => {
        const splitted = key.split('/')
        const cond1 = !splitted.at(-1)?.startsWith(':')
        const cond2 = coveredMethods.some((method) => method in value)
        return (
          splitted.filter((item) => item.startsWith(':')).length > 1 && cond2
        )
      })
      .map(([key]) => key), */
    sdk.collection.collection('BANANA-e955fd').profile.PATCH({
      body: {
        name: 'hello',
        description: 'world',
        socials: { twitter: 'https://xoxno.com' },
      },
      auth: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZGRyZXNzIjoiZXJkMXk2anNscnQ1ODRod3hjemsyaHZyZXpzNHBldDg3OTM2dHRxaHp4NjNsbXp3c2c4Z213MnNycXh2NDciLCJzdWIiOiJBdXRoIGZvciBYT1hOTyBtYWlubmV0IEFQSXMiLCJjaGFpbiI6Ik1WWCIsImlhdCI6MTc1MzM0NTk3NCwiZXhwIjoxNzUzNDMyMzc0LCJpc3MiOiJYT1hOTyBOZXR3b3JrIn0.pIlZTj-5gTSmHBANQSnbbdsmj8cxde4R2535idaJUXU',
    })
  )
}

_fn()
