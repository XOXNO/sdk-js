import { ExtensionProvider } from '@multiversx/sdk-extension-provider'
import { WalletClientType } from '@xoxno/types/enums'
import { setCookie } from 'cookies-next'

import { getSdk } from './get-sdk'
import { NativeAuthClient } from './native-auth'

async function main() {
  const provider = ExtensionProvider.getInstance()

  await provider.init()

  const nativeAuthClient = new NativeAuthClient()

  const loginMethod = WalletClientType.EXTENSION

  const { token } = await nativeAuthClient.initialize({
    loginMethod,
  })

  const { address, signature } = await provider.login({ token })

  const { loginToken } = nativeAuthClient.getToken({
    address,
    token,
    signature,
  })

  const { access_token, expires } = await getSdk().user.login.POST({
    body: {
      loginToken,
      signature,
      address,
    },
  })

  // store the access_token for later usage
  setCookie('xoxno-auth', access_token, {
    expires: new Date(expires * 1000),
    sameSite: 'strict',
    secure: true,
  })

  // from now on you can call protected endpoints on behalf of `address`

  const newUserProfile = await getSdk()
    .user.address(address)
    .profile.PATCH({
      body: {
        description: 'XOXNO SDK rocks!',
      },
      auth: access_token,
    })

  console.log(newUserProfile.description) // XOXNO SDK rocks!
}

main()
