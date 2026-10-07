import type { LendingAsset, LendingAssetUsage, LendingPosition } from './types'

export interface StellarLendingReadClientOptions {
  /** API root, for example https://api.xoxno.com. May include a deployment prefix. */
  baseUrl: string
  /** Inject the host's fetch implementation when unavailable globally; it must honor redirect: 'error'. */
  fetch?: typeof globalThis.fetch
}

export interface StellarLendingReadOptions {
  signal?: AbortSignal
}

export interface StellarLendingReadClient {
  /** Omitted usage defaults to collateral on the API. */
  assets(options?: StellarLendingReadOptions & { usage?: LendingAssetUsage }): Promise<LendingAsset[]>
  /** Collect every page, including a next link on an empty page. */
  positions(owner: string, options?: StellarLendingReadOptions): Promise<LendingPosition[]>
}

function nextLink(header: string | null): string | undefined {
  if (!header) return undefined
  // Match complete link-values, including commas inside URIs and quoted parameters.
  const link = /\s*<([^<>\s]+)>\s*((?:;\s*[\w!#$%&'*+.^`|~-]+\s*=\s*(?:"(?:[^"\\\r\n]|\\.)*"|[\w!#$%&'*+.^`|~:/-]+)\s*)*)(,|$)/gy
  let next: string | undefined
  let offset = 0
  while (offset < header.length) {
    const match = link.exec(header)
    if (!match || (match[3] && link.lastIndex === header.length)) {
      throw new Error('Invalid pagination Link header')
    }
    let isNext = false
    let hasRelation = false
    for (const parameter of match[2].matchAll(/;\s*([\w!#$%&'*+.^`|~-]+)\s*=\s*(?:"((?:[^"\\\r\n]|\\.)*)"|([\w!#$%&'*+.^`|~:/-]+))\s*/g)) {
      if (parameter[1].toLowerCase() !== 'rel') continue
      if (hasRelation) throw new Error('Duplicate pagination link relation')
      hasRelation = true
      const relation = (parameter[2] ?? parameter[3]).replace(/\\(.)/g, '$1')
      isNext = relation.toLowerCase().split(/\s+/).includes('next')
    }
    if (isNext) {
      if (next !== undefined) throw new Error('Multiple next pagination links')
      next = match[1]
    }
    offset = link.lastIndex
  }
  return next
}

export function createStellarLendingReadClient(
  options: StellarLendingReadClientOptions,
): StellarLendingReadClient {
  const base = new URL(options.baseUrl.trim())
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error('baseUrl must be an HTTP API root without credentials, query or fragment')
  }
  base.pathname = `${base.pathname.replace(/\/+$/, '')}/`
  const fetcher = options.fetch ?? globalThis.fetch?.bind(globalThis)
  if (!fetcher) throw new Error('A fetch implementation is required')

  async function pages<T>(path: string, signal?: AbortSignal): Promise<T[]> {
    const endpoint = new URL(`stellar-lending/v1/${path}`, base)
    let url = endpoint
    const visited = new Set<string>()
    const result: T[] = []
    while (true) {
      if (visited.has(url.href)) throw new Error('Pagination Link cycle')
      visited.add(url.href)
      // Reject redirects before a custom fetch could forward credentials to another host.
      const response = await fetcher(url.href, { signal, redirect: 'error' })
      if (response.redirected || (response.url && new URL(response.url).href !== url.href)) {
        throw new Error('Stellar lending redirects are not allowed')
      }
      if (!response.ok) throw new Error(`Stellar lending request failed: HTTP ${response.status}`)
      const rows: unknown = await response.json()
      if (!Array.isArray(rows)) throw new Error('Stellar lending response must be an array')
      result.push(...rows)
      const next = nextLink(response.headers.get('Link'))
      if (!next) break
      const target: URL = new URL(next, url)
      if (target.origin !== endpoint.origin || target.pathname !== endpoint.pathname || target.username || target.password || target.hash) {
        throw new Error('Pagination Link must stay on the same API endpoint')
      }
      url = target
    }
    return result
  }

  return {
    assets: ({ usage, signal } = {}) => {
      if (usage !== undefined && usage !== 'collateral' && usage !== 'borrow') {
        throw new Error('usage must be collateral or borrow')
      }
      return pages<LendingAsset>(`assets${usage ? `?usage=${usage}` : ''}`, signal)
    },
    positions: (owner, { signal } = {}) => {
      if (!owner.trim() || owner === '.' || owner === '..') throw new Error('owner is required')
      return pages<LendingPosition>(`users/${encodeURIComponent(owner)}/positions`, signal)
    },
  }
}
