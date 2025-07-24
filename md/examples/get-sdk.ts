import { cache } from 'react'

import { buildSdk, Chain, XOXNOClient } from '@xoxno/sdk-js'

// You can safely call `getSdk()` wherever you need it
export const getSdk = cache(() => {
  XOXNOClient.init({ apiUrl: 'https://api.xoxno.com', chain: Chain.MAINNET })

  return buildSdk(XOXNOClient.getInstance())
})
