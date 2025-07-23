import { getSdk } from './basic'

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
