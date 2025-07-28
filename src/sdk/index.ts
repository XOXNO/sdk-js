import type { OurRequestInit, XOXNOClient } from '../utils/api'
import { AddressNotFoundError, CollectionNotFoundError } from '../utils/errors'
import { isAddressValid } from '../utils/helpers'
import { isValidCollectionTicker } from '../utils/regex'
import { endpoints as routes } from './swagger'
import type { SDK } from './types'
import { coveredMethods, type ICoveredMethods } from './utils'

const kebabToCamel = (s: string) =>
  s.replace(/-([a-z])/g, (_, c) => c.toUpperCase())

type RouteDef = (typeof routes)[keyof typeof routes]
interface LeafTpl {
  rawPath: string
  def: RouteDef
}
interface NodeTpl {
  static: Record<string, NodeTpl>
  params: Record<string, NodeTpl>
  leaves: LeafTpl[]
}
const makeNode = (): NodeTpl => ({ static: {}, params: {}, leaves: [] })

function buildTemplate(): NodeTpl {
  const root = makeNode()
  for (const [rawPath, def] of Object.entries(routes)) {
    const segs = rawPath.split('/').filter(Boolean)
    let node = root
    for (const seg of segs) {
      if (seg.startsWith(':')) {
        const p = kebabToCamel(seg.slice(1))
        node = node.params[p] ||= makeNode()
      } else {
        const k = kebabToCamel(seg)
        node = node.static[k] ||= makeNode()
      }
    }
    node.leaves.push({ rawPath, def })
  }
  return root
}

export function buildSdk(client: XOXNOClient): SDK {
  const tplRoot = buildTemplate()

  const instantiate = (tpl: NodeTpl, bound: Record<string, any>): any => {
    // 1) detect “one leaf + other children” case
    const leafCount = tpl.leaves.length
    const staticCount = Object.keys(tpl.static).length
    const paramCount = Object.keys(tpl.params).length
    const isLeafWithChildren = leafCount === 1 && staticCount + paramCount > 0

    let obj: any
    // 2) if exactly one leaf and it has static/param siblings → use its handler as the root object
    if (isLeafWithChildren) {
      const { rawPath, def } = tpl.leaves[0]
      obj = makeLeafHandler(rawPath, def, bound, client)
    } else {
      // otherwise, build a plain object and attach all leaves under their keys
      obj = {}
      for (const { rawPath, def } of tpl.leaves) {
        const leafKey = kebabToCamel(
          rawPath.split('/').pop()!.replace(/^:/, '')
        )
        obj[leafKey] = makeLeafHandler(rawPath, def, bound, client)
      }
    }

    // 3) now merge in all the static‐children
    for (const [key, childTpl] of Object.entries(tpl.static)) {
      const produced = instantiate(childTpl, bound)
      // exactly your existing “flatten‐or‐assign” logic will work here
      let flat: any = produced
      if (
        produced &&
        typeof produced === 'object' &&
        key in produced &&
        typeof (produced as any)[key] === 'function'
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        const fn = (produced as any)[key] as Function
        const rest = Object.fromEntries(
          Object.entries(produced).filter(([k]) => k !== key)
        )
        const isParamHandler = fn.length === 1
        if (!isParamHandler) {
          Object.assign(fn, rest)
          flat = fn
        }
      }

      if (obj[key] === undefined) {
        obj[key] = flat
      } else if (typeof obj[key] === 'function') {
        Object.assign(obj[key], flat)
      } else if (typeof flat === 'function') {
        Object.assign(flat, obj[key])
        obj[key] = flat
      } else {
        Object.assign(obj[key], flat)
      }
    }

    // 4) and then all the param‐children exactly as before
    for (const [paramKey, childTpl] of Object.entries(tpl.params)) {
      const paramFn = (value: string) => {
        const produced = instantiate(childTpl, { ...bound, [paramKey]: value })

        // your existing “unwrap single‐key proxy” hack
        if (
          produced &&
          typeof produced === 'object' &&
          Object.keys(produced).length === 1 &&
          paramKey in produced &&
          typeof (produced as any)[paramKey] === 'function'
        ) {
          const leaf = (produced as any)[paramKey] as (...a: any[]) => any
          const proxy = (...a: any[]) => leaf(...a)
          return Object.assign(proxy, leaf)
        }

        return produced
      }

      if (obj[paramKey]) {
        const prev = obj[paramKey] as (v: string) => any
        obj[paramKey] = (v: string) => ({ ...prev(v), ...paramFn(v) })
      } else {
        obj[paramKey] = paramFn
      }
    }

    return obj
  }

  return instantiate(tplRoot, {}) as SDK
}

function makeLeafHandler(
  rawPath: string,
  def: RouteDef,
  bound: Record<string, any>,
  client: XOXNOClient
) {
  const { input: _input, output: _output, ...rest } = def

  const core = async (
    args: typeof _input & OurRequestInit & { body?: object } = {}
  ) => {
    const fullArgs = { ...bound, ...args }
    const url = rawPath.replace(
      /:([a-zA-Z_]+)/g,
      (_, p) => `${fullArgs[p as keyof typeof fullArgs]}`
    )

    const paramNames = [...rawPath.matchAll(/:([a-zA-Z_]+)/g)].map((m) => m[1])
    const extraArgs = Object.fromEntries(
      Object.entries(fullArgs).filter(([k]) => !paramNames.includes(k))
    )

    const hasAddress = /:address[^A-Z]/.test(rawPath) || 'address' in extraArgs
    const hasCollection =
      /:collection[^A-Z]/.test(rawPath) || 'collection' in extraArgs

    if (hasAddress) {
      const addr = (fullArgs as any).address
      if (!isAddressValid(addr)) throw new AddressNotFoundError(addr)
    }
    if (hasCollection) {
      const col = (fullArgs as any).collection
      const bad = Array.isArray(col)
        ? col.some((x: string) => !isValidCollectionTicker(x))
        : !isValidCollectionTicker(col)
      if (bad) throw new CollectionNotFoundError(col)
    }

    const extraArgsConv = Object.fromEntries(
      Object.entries(extraArgs).map(([k, v]) => [
        k,
        k === 'filter' || (k === 'body' && !(v instanceof FormData))
          ? JSON.stringify(v)
          : Array.isArray(v)
            ? v.join(',')
            : v,
      ])
    )

    const { body, auth, method, headers, ...params } = extraArgsConv

    const Authorization = auth ? `Bearer ${auth}` : undefined
    const headersData = {
      ...(headers as HeadersInit),
      ...(Authorization ? { Authorization } : {}),
    }

    return client.fetchWithTimeout<typeof _output>(url, {
      method,
      params,
      body,
      headers: headersData,
    })
  }

  const leaf: any = (args = {}) => core(args)
  for (const verb of Object.keys(rest)) {
    if (!coveredMethods.includes(verb as ICoveredMethods)) continue
    leaf[verb] = (va: any) =>
      core({ ...va, method: va.method ?? verb.toUpperCase() })
  }
  return leaf
}
