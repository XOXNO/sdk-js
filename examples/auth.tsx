import { ExtensionProvider } from '@multiversx/sdk-extension-provider'
import { setCookie } from 'cookies-next'

import { getSdk } from './basic'
import { NativeAuthClient } from './native-auth'

async function main() {
  const sdk = getSdk()

  const provider = ExtensionProvider.getInstance()

  await provider.init()

  const nativeAuthClient = new NativeAuthClient()

  const loginMethod = 'extension'

  const { token } = await nativeAuthClient.initialize({
    loginMethod,
  })

  /* every time you login with a MultiversX provider, be it Extension, xPortal, Web Wallet or Ledger,
     you have the possibility to pass a loginToken, and get back address and signature */
  const { address, signature } = await provider.login({ token })

  // obtain the accessToken that is exchanged for a XOXNO Auth Token
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
