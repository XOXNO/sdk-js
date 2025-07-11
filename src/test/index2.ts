import { ActivityChain } from '@xoxno/types/dist/common/enums'

import { XOXNOClient } from '../utils/api'
import { AddressNotFoundError, CollectionNotFoundError } from '../utils/errors'
import { isAddressValid } from '../utils/helpers'
import { isValidCollectionTicker } from '../utils/regex'
import { routes } from './endpoints'

// ──────────────────────────────────────────────────────────────
//  ORIGINAL HELPERS  (unchanged)
// ──────────────────────────────────────────────────────────────
type RemoveColon<S extends string> = S extends `:${infer R}` ? R : S
type CamelCase<S extends string> =
  S extends `${infer H}-${infer T}${infer Rest}`
    ? `${H}${Capitalize<`${T}${Rest}`>}`
    : S

type IsEmptyObj<T> = keyof T extends never ? true : false
type NeedsDefault<I, O> =
  IsEmptyObj<I> extends true
    ? IsEmptyObj<O> extends true
      ? false
      : true
    : true

type CollectParams<S extends string> =
  S extends `${string}:${infer P}/${infer R}`
    ? { [K in P]: string } & CollectParams<`/${R}`>
    : S extends `${string}:${infer P}`
      ? { [K in P]: string }
      : object

type VerbExtras<Full, PBag> = {
  [M in keyof Full as M extends 'input' | 'output' | 'joinArrays'
    ? never
    : M]: Full[M] extends { input: infer VI; output: infer VO }
    ? (args: (VI & PBag) & { body?: string }, init?: RequestInit) => Promise<VO>
    : never
}

// ──────────────────────────────────────────────────────────────
//  CURRIED PATH  →  TREE
// ──────────────────────────────────────────────────────────────
type DropKey<T, K extends PropertyKey> = { [P in Exclude<keyof T, K>]: T[P] }

type RequiredKeys<T> = {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K
}[keyof T]

// “true” if there's at least one required key
type HasRequiredKeys<T> = [RequiredKeys<T>] extends [never] ? false : true

type PathToTree<
  P extends string,
  I,
  O,
  Full = { input: I; output: O },
  Root extends string = P,
  Bag extends object = CollectParams<Root>,
> = P extends `/${infer Head}/${infer Rest}`
  ? Head extends `:${infer Param}`
    ? {
        [K in CamelCase<Param>]: (
          value: string
        ) => PathToTree<`/${Rest}`, I, O, Full, Root, DropKey<Bag, Param>>
      }
    : { [K in CamelCase<Head>]: PathToTree<`/${Rest}`, I, O, Full, Root, Bag> }
  : P extends `/${infer Leaf}`
    ? {
        [K in CamelCase<RemoveColon<Leaf>>]: (NeedsDefault<I, O> extends true
          ? HasRequiredKeys<I & Bag> extends true
            ? (args: I & Bag, init?: RequestInit) => Promise<O>
            : (args?: I & Bag, init?: RequestInit) => Promise<O>
          : object) &
          VerbExtras<Full, Bag>
      }
    : never

// ──────────────────────────────────────────────────────────────
//  ★  THE TWO KEY UTILITIES  ★
// ──────────────────────────────────────────────────────────────
type AnyFn = (...a: any[]) => any
type IsFn<T> = T extends AnyFn ? true : false

/* union → intersection helper */
type U2I<U> = (U extends any ? (k: U) => 0 : never) extends (k: infer I) => 0
  ? I
  : never

type UnionKeys<U> = U extends any ? keyof U : never

/* ①  merge duplicate keys; if the value is /becomes/ a union of
      functions, immediately fuse it into one function               */
type CollapseFnUnion<F> = (
  ...a: Parameters<Extract<F, AnyFn>>
) => U2I<F extends AnyFn ? ReturnType<F> : never>

// grab the values for key K *only* from the objects that actually have it
type ValuesForKey<U, K extends PropertyKey> = Exclude<
  U extends any ? (K extends keyof U ? U[K] : never) : never,
  never
>

type MergeRec<U> = [U] extends [object]
  ? IsFn<U> extends true
    ? CollapseFnUnion<U>
    : {
        // ▼── use ValuesForKey here
        [K in UnionKeys<U>]: MergeRec<ValuesForKey<U, K>>
      }
  : U

/* ②  prettify */
type SimplifyDeep<T> =
  IsFn<T> extends true
    ? T
    : T extends object
      ? { [K in keyof T]: SimplifyDeep<T[K]> }
      : T

// ──────────────────────────────────────────────────────────────
//  BUILD THE SDK
// ──────────────────────────────────────────────────────────────
type SDKUnion = {
  [R in keyof typeof routes]: PathToTree<
    R,
    (typeof routes)[R]['input'],
    (typeof routes)[R]['output'],
    (typeof routes)[R]
  >
}[keyof typeof routes]

export type SDK = SimplifyDeep<MergeRec<SDKUnion>>

/* ------------------------------------------------------------- */
/* helpers you already had                                       */
/* ------------------------------------------------------------- */
const kebabToCamel = (s: string) =>
  s.replace(/-([a-z])/g, (_, c) => c.toUpperCase())

/* ---------- template-tree types ---------- */
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

/* ---------- step 1: template tree ---------- */
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

/* ---------- step 2: runtime instantiation ---------- */
export function buildSdk(client: XOXNOClient): SDK {
  const tplRoot = buildTemplate()

  const instantiate = (tpl: NodeTpl, bound: Record<string, any>): any => {
    const obj: any = {}

    /* ---- 1. leaves FIRST (create callable) ---- */
    for (const { rawPath, def } of tpl.leaves) {
      const leafKey = kebabToCamel(rawPath.split('/').pop()!.replace(/^:/, ''))
      const handler = makeLeafHandler(rawPath, def, bound, client)
      obj[leafKey] = handler // cannot exist yet
    }

    /* ---- 2. static children ---- */
    for (const [key, childTpl] of Object.entries(tpl.static)) {
      const result = instantiate(childTpl, bound)

      if (!obj[key]) {
        // flatten single-key wrappers:
        if (
          typeof result === 'object' &&
          Object.keys(result).length === 1 &&
          // eslint-disable-next-line no-prototype-builtins
          result.hasOwnProperty(key)
        ) {
          obj[key] = (result as any)[key]
        } else {
          obj[key] = result
        }
      } else if (typeof obj[key] === 'function') {
        // existing merge-for-overloads logic
        Object.assign(obj[key], result)
      } else {
        obj[key] = result
      }
    }

    /* ---- 3. parameter children ---- */
    for (const [paramKey, childTpl] of Object.entries(tpl.params)) {
      const paramFn = (value: string) =>
        instantiate(childTpl, { ...bound, [paramKey]: value })

      if (obj[paramKey]) {
        const prev = obj[paramKey] as (v: string) => any
        obj[paramKey] = (v: string) => ({
          ...prev(v),
          ...paramFn(v),
        })
      } else {
        obj[paramKey] = paramFn
      }
    }

    return obj
  }

  return instantiate(tplRoot, {}) as SDK
}

/* ---------- step 3: leaf handler (unchanged logic) ---------- */
function makeLeafHandler(
  rawPath: string,
  def: RouteDef,
  bound: Record<string, any>,
  client: XOXNOClient
) {
  const { input, output, ...rest } = def

  const core = (args: typeof input = {}, init: RequestInit = {}) => {
    const fullArgs = { ...bound, ...args }
    const url = rawPath.replace(
      /:([a-zA-Z_]+)/g,
      (_, p) => fullArgs[p as keyof typeof fullArgs]
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

    const extraArgsConv =
      'filters' in extraArgs
        ? { filter: JSON.stringify(extraArgs) }
        : Object.fromEntries(
            Object.entries(extraArgs).map(([k, v]) => [
              k,
              'joinArrays' in rest && rest.joinArrays && Array.isArray(v)
                ? v.join(',')
                : v,
            ])
          )

    const { body, ...params } = extraArgsConv
    return client.fetchWithTimeout(url, {
      ...init,
      params,
      body: Array.isArray(body) ? body[0] : body,
    }) as Promise<typeof output>
  }

  const leaf: any = (args = {}, init: RequestInit = {}) => core(args, init)
  for (const verb of Object.keys(rest)) {
    if (['input', 'output', 'joinArrays'].includes(verb)) continue
    leaf[verb] = (va: any, init: RequestInit = {}) =>
      core(va, { method: init.method ?? verb.toUpperCase(), ...init })
  }
  return leaf
}

async function fn() {
  XOXNOClient.init()
  const sdk = buildSdk(XOXNOClient.getInstance())

  const result = await Promise.all([
    sdk.collection.collection('EAPES-8f3c1f').profile(),
    sdk.collection.collection('EAPES-8f3c1f').floorPrice({}),
    sdk.collection.floorPrice({
      collection: ['MICE-a0c447', 'EAPES-8f3c1f'],
      token: 'EGLD',
    }),
    sdk.collection.pinned({ chain: [ActivityChain.SUI] }),
    sdk.collection.pinnedDrops({ chain: [ActivityChain.SUI] }),
    sdk.collection.collection('EAPES-8f3c1f').pinnedDrops({}),
    sdk.collection.collection('EAPES-8f3c1f').pinned({}),
    sdk.collection
      .collection('EAPES-8f3c1f')
      .profile.PATCH(
        {},
        {
          headers: { Authorization: 'Bearer 123' },
          body: JSON.stringify({
            foo: 'bar',
          }),
        }
      )
      .catch(() => null),
    sdk.collection
      .collection('EAPES-8f3c1f')
      .follow.POST(
        {},
        {
          headers: { Authorization: 'Bearer 123' },
          body: JSON.stringify({
            foo: 'bar',
          }),
        }
      )
      .catch(() => null),
    sdk.collection.query({
      filters: {
        collection: ['EAPES-8f3c1f'],
      },
    }),
    sdk.collection
      .creatorTag('MiceCityClub')
      .collectionTag('MiceCity')
      .dropInfo({}),
  ])
  console.log(result)
}

fn()
