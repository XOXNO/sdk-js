import { cache } from 'react'

import { buildSdk, XOXNOClient } from '@xoxno/sdk-js'
const apiUrl = 'https://api.example.com'

// You can safely call `getSdk()` wherever you need it
export const getSdk = cache(() => {
  return buildSdk(new XOXNOClient({ apiUrl }))
})
