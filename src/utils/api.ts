import type { IChainID } from '@multiversx/sdk-core/out/interface'

import {
  API_URL,
  API_URL_DEV,
  DR_SC,
  FM_SC,
  KG_SC,
  Manager_SC,
  Manager_SC_DEV,
  P2P_SC,
  P2P_SC_DEV,
  Staking_SC,
  Staking_SC_DEV,
  XOXNO_SC,
  XOXNO_SC_DEV,
} from './const'

// use the "auth" property when prompted
export type SafeHeaders = Record<string, string> & {
  authorization?: never
  Authorization?: never
}

export type OurRequestInit = Omit<RequestInit, 'body' | 'headers'> & {
  headers?: SafeHeaders
  debug?: boolean
}

type IInit = OurRequestInit & {
  cache?: RequestCache
  next?: { revalidate?: number }
}

export enum Chain {
  MAINNET = '1',
  DEVNET = 'D',
}
export class XOXNOClient {
  public apiUrl: string
  public chain: IChainID
  public init: OurRequestInit
  public config: {
    mediaUrl: string
    gatewayUrl: string
    XO_SC: string
    FM_SC: string
    DR_SC: string
    KG_SC: string
    Staking_SC: string
    Manager_SC: string
    P2P_SC: string
  }

  constructor({
    chain = Chain.MAINNET,
    apiUrl = API_URL,
    ...init
  }: { chain?: Chain; apiUrl?: string } & OurRequestInit = {}) {
    this.apiUrl =
      apiUrl ?? { [Chain.MAINNET]: API_URL, [Chain.DEVNET]: API_URL_DEV }[chain]
    this.chain = chain
    this.init = init
    this.config =
      chain == Chain.MAINNET
        ? {
            mediaUrl: 'https://media.xoxno.com',
            gatewayUrl: 'https://gateway.xoxno.com',
            XO_SC: XOXNO_SC,
            FM_SC: FM_SC,
            DR_SC,
            KG_SC,
            Staking_SC,
            Manager_SC,
            P2P_SC,
          }
        : {
            mediaUrl: 'https://devnet-media.xoxno.com',
            gatewayUrl: 'https://devnet-gateway.xoxno.com',
            XO_SC: XOXNO_SC_DEV,
            FM_SC,
            DR_SC,
            KG_SC,
            Staking_SC: Staking_SC_DEV,
            Manager_SC: Manager_SC_DEV,
            P2P_SC: P2P_SC_DEV,
          }
  }

  public fetchWithTimeout = async <T>(
    path: string,
    {
      params,
      ...options
    }: RequestInit & {
      debug?: boolean
      params?: Record<string, any>
    } = {}
  ): Promise<T> => {
    const { next, cache, debug, ...rest } = this.init as IInit

    const {
      next: overwriteNext,
      cache: overwriteCache,
      debug: overwriteDebug,
      headers,
      method = 'GET',
      ...overwriteRest
    } = options as IInit

    const authHeader = (headers as { Authorization?: string })?.Authorization

    const Authorization =
      authHeader === 'Bearer undefined' ? undefined : authHeader

    const allHeaders = {
      ...headers,
      Referer: 'https://xoxno.sdk',
      'User-Agent': 'XOXNO/1.0/SDK',
      ...(method === 'PUT' ? {} : { 'Content-Type': 'application/json' }),
      ...(Authorization ? { Authorization } : {}),
    }

    const query = Object.entries(params ?? {})
      .flatMap(([key, value]) => {
        if (Array.isArray(value)) {
          return value.map((v) => `${key}=${encodeURIComponent(v)}`)
        } else {
          return `${key}=${encodeURIComponent(value)}`
        }
      })
      .join('&')

    const url = `${this.apiUrl}${path}${query.length ? `?${query}` : ''}`

    const { revalidate, ...other } = next ?? {}

    const { revalidate: overwriteRevalidate, ...overwriteOther } =
      overwriteNext ?? {}

    const finalRevalidate =
      method === 'GET' && !Authorization
        ? (overwriteRevalidate ?? revalidate)
        : undefined

    const finalCache =
      method === 'GET' && !Authorization && !finalRevalidate
        ? (overwriteCache ?? cache)
        : undefined

    const init = {
      ...rest,
      ...overwriteRest,
      method,
      ...(Object.keys(allHeaders).length ? { headers: allHeaders } : {}),
      cache: finalCache,
      next: {
        ...other,
        ...overwriteOther,
        revalidate: finalRevalidate,
      },
    }

    if (overwriteDebug ?? debug) {
      console.debug('SDK fetch: ', url, init)
    }

    const res = await fetch(url, init as RequestInit).catch((error) => {
      if (error instanceof Error && !error.message.match(/^http(s?):\/\//)) {
        throw new Error(`${url}: ${error.message}`)
      }
      throw error
    })

    const text = await res.text()

    if (!res.ok) {
      let message

      try {
        message = JSON.parse(text)
      } catch (_) {
        message = { message: text }
      }

      const errorMessage = [url, res.status, res.statusText, message.message]
        .filter(Boolean)
        .join(';;')

      throw new Error(errorMessage)
    }

    try {
      return JSON.parse(text) as T
    } catch (_) {
      return text as T
    }
  }
}
