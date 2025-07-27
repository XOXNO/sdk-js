import { cache } from 'react'

import { buildSdk, XOXNOClient } from '@xoxno/sdk-js'

// You can safely call `getSdk()` wherever you need it
export const getSdk = cache(() => {
  return buildSdk(new XOXNOClient())
})
