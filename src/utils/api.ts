import {
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
  /**
   * Milliseconds before the request is aborted, as a client-wide default or a
   * per-call override. `0` disables the deadline for that call.
   *
   * Defaults to {@link DEFAULT_REQUEST_TIMEOUT_MS} for requests with no body.
   * Requests that send a body are left unbounded by default because their
   * duration depends on the caller's uplink — a multipart upload on a slow
   * mobile connection is not a stalled request. Pass `timeout` explicitly to
   * bound those.
   */
  timeout?: number
}

/**
 * Default read deadline. Without one, a stalled response is bounded only by
 * whatever the host runtime imposes (in Node, undici's Agent), which is
 * typically longer than the caller's own budget — a Next.js `'use cache'` fill,
 * for instance, gives up at `staticPageGenerationTimeout * 0.9` and turns the
 * stall into a hard error instead of a fetch rejection the caller can degrade
 * on. Generous enough that only a genuinely stuck read hits it.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

/**
 * Host-supplied configuration for {@link XOXNOClient}.
 *
 * The SDK does not read environment variables or choose an API deployment.
 * Always pass the API base URL from the application configuration. `chain`
 * selects the MultiversX contract set used by generated endpoints; Stellar
 * transaction builders take their own explicit network and contract options.
 */
export type XOXNOClientOptions = { chain?: Chain; apiUrl: string } & OurRequestInit

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
  public chain: Chain
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

  /** Create a client bound to one application-selected API deployment. */
  constructor(options: XOXNOClientOptions) {
    if (!options?.apiUrl?.trim()) {
      throw new Error('XOXNOClient: apiUrl is required')
    }
    const { chain = Chain.MAINNET, apiUrl, ...init } = options
    this.apiUrl = apiUrl.trim().replace(/\/$/, '')
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
      timeout?: number
    } = {}
  ): Promise<T> => {
    const { next, cache, debug, timeout, ...rest } = this.init as IInit

    const {
      next: overwriteNext,
      cache: overwriteCache,
      debug: overwriteDebug,
      timeout: overwriteTimeout,
      headers,
      method = 'GET',
      ...overwriteRest
    } = options as IInit

    const authHeader = (headers as { Authorization?: string })?.Authorization

    const Authorization =
      authHeader === 'Bearer undefined' ? undefined : authHeader

    // A GET/HEAD has no body, so Content-Type describes nothing — but in a
    // browser it is the difference between a "simple" CORS request and one
    // that needs a preflight. `application/json` is not on the CORS-safelist,
    // so setting it here made every unauthenticated GET cost an extra OPTIONS
    // round trip to the origin (~180k/week, 17% of all API requests, ~200ms
    // each, none of them cacheable at the edge).
    //
    // Authenticated calls still preflight — Authorization is not safelisted
    // either — and that is unavoidable. This only stops charging public reads
    // for a header that carries no meaning on a bodyless request.
    const hasBody = method !== 'GET' && method !== 'HEAD' && method !== 'PUT'

    const allHeaders = {
      ...headers,
      // Both are forbidden header names: browsers drop them silently, so they
      // only ever apply to server-side (Node) callers.
      Referer: 'https://xoxno.sdk',
      'User-Agent': 'XOXNO/1.0/SDK',
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(Authorization ? { Authorization } : {}),
    }

    const query = Object.entries(params ?? {})
      .filter(([, value]) => value !== undefined)
      .flatMap(([key, value]) => {
        if (Array.isArray(value)) {
          return value.filter((v) => v !== undefined).map((v) => `${key}=${encodeURIComponent(v)}`)
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

    // A body's duration is uplink-bound, so it is only deadlined when the caller
    // asks for it; a read is not.
    const body = (overwriteRest as RequestInit).body
    const effectiveTimeout =
      overwriteTimeout ??
      timeout ??
      (body == null ? DEFAULT_REQUEST_TIMEOUT_MS : 0)

    const deadline =
      effectiveTimeout > 0 ? AbortSignal.timeout(effectiveTimeout) : undefined
    const callerSignal =
      (overwriteRest as RequestInit).signal ?? (rest as RequestInit).signal
    const signal =
      deadline && callerSignal
        ? AbortSignal.any([callerSignal, deadline])
        : (deadline ?? callerSignal)

    const init = {
      ...rest,
      ...overwriteRest,
      method,
      ...(Object.keys(allHeaders).length ? { headers: allHeaders } : {}),
      ...(signal ? { signal } : {}),
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
        // Preserve the underlying network reason as `cause` — the undici/system
        // error carries the real code (UND_ERR_SOCKET, ECONNREFUSED, ENOTFOUND,
        // timeouts). Without it the thrown message is only "<url>: fetch failed".
        throw Object.assign(new Error(`${url}: ${error.message}`), {
          cause: error,
        })
      }
      throw error
    })

    const text = await res.text()

    if (!res.ok) {
      let message

      try {
        message = JSON.parse(text)
      } catch {
        message = { message: text }
      }

      const errorMessage = [url, res.status, res.statusText, message.message]
        .filter(Boolean)
        .join(';;')

      throw new Error(errorMessage)
    }

    try {
      return JSON.parse(text) as T
    } catch {
      return text as T
    }
  }
}
