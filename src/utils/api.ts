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

export enum Chain {
  MAINNET = '1',
  DEVNET = 'D',
}
export class XOXNOClient {
  public apiUrl: string
  public chain: IChainID
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
  }: { chain?: Chain; apiUrl?: string } = {}) {
    this.apiUrl =
      apiUrl ?? { [Chain.MAINNET]: API_URL, [Chain.DEVNET]: API_URL_DEV }[chain]
    this.chain = chain
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
    { params, ...options }: RequestInit & { params?: Record<string, any> } = {}
  ): Promise<T> => {
    const authHeader = (options?.headers as { Authorization?: string })
      ?.Authorization

    const Authorization =
      authHeader === 'Bearer undefined' ? undefined : authHeader

    const headers = {
      ...options.headers,
      Referer: 'https://xoxno.sdk',
      'User-Agent': 'XOXNO/1.0/SDK',
      ...(options.method === 'PUT'
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...(Authorization ? { Authorization } : {}),
    }

    const shouldInsertOrigin = typeof path === 'string' && path.startsWith('/')

    const url = `${shouldInsertOrigin ? `${this.apiUrl}${path}` : path}${
      params
        ? '?' +
          Object.entries(params)
            .flatMap(([key, value]) => {
              if (Array.isArray(value)) {
                return value.map((v) => `${key}=${encodeURIComponent(v)}`)
              } else {
                return `${key}=${encodeURIComponent(value)}`
              }
            })
            .join('&')
        : ''
    }`

    const allHeaders = {
      ...options,
      ...(Object.keys(headers).length ? { headers } : {}),
      method: options.method ?? 'GET',
    }

    const res = await fetch(url, allHeaders)

    const text = await res.text()

    if (!res.ok) {
      let message

      try {
        message = JSON.parse(text)
      } catch (_) {
        message = { message: text }
      }

      throw new Error(
        `${path};${res.status};${res.statusText};${message.message}`
      )
    }

    try {
      return JSON.parse(text) as T
    } catch (_) {
      return text as T
    }
  }
}
