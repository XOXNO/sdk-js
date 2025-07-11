import { ActivityChain } from '@xoxno/types/dist/common/enums'

import { XOXNOClient } from '../utils/api'
import { AddressNotFoundError, CollectionNotFoundError } from '../utils/errors'
import { isAddressValid } from '../utils/helpers'
import { isValidCollectionTicker } from '../utils/regex'
import { routes } from './endpoints'

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

// Drop a key from an index-signature bag
type DropKey<Bag, K extends PropertyKey> = {
  [P in Exclude<keyof Bag, K>]: Bag[P]
}

type IsFn<T> = T extends (...args: any[]) => any ? true : false

// ──────────────────────────────────────────────────────────
//   Merge a *union* of objects into one object whose keys are
//   the union of the keys, and whose values are the *union*
//   of the values found under that key.
//   (We recurse so it works at every depth.)
type UnionKeys<U> = U extends any ? keyof U : never

type MergeDeep<U> =
  IsFn<U> extends true
    ? U // stop at functions
    : U extends object
      ? {
          [K in UnionKeys<U>]: MergeDeep<
            U extends any
              ? K extends keyof U // pull the value for K
                ? U[K]
                : never
              : never
          >
        }
      : U

// ──────────────────────────────────────────────────────────
//   Collapse a *union* of functions into ONE function that keeps
//   the same argument list but returns the INTERSECTION of
//   the individual return types.
type MergeFnUnion<F> = [F] extends [(...args: infer A) => any] // tuple = no distribution
  ? (...args: A) => (
      F extends (...args: any) => infer R ? R : never
    ) extends infer U
      ? (U extends any ? U : never) extends never // nothing? never → never
        ? never
        : UnionToIntersection<U> // union → intersection
      : never
  : never

type CollapseFnUnions<T> = [T] extends [(...args: any[]) => any] // tuple = no distribution
  ? MergeFnUnion<T>
  : T extends object
    ? { [K in keyof T]: CollapseFnUnions<T[K]> }
    : T

type PathToTree<
  P extends string,
  I,
  O,
  Full = { input: I; output: O },
  Root extends string = P, // original path
  Bag extends object = CollectParams<Root>, // “params left to collect”
> =
  // ------ still more segments --------
  P extends `/${infer Head}/${infer Rest}`
    ? Head extends `:${infer Param}` // — a param segment —
      ? {
          [K in CamelCase<Param>]: (
            value: string
          ) => //   collection('<id>') // e.g. “collection”
          PathToTree<
            `/${Rest}`,
            I,
            O,
            Full,
            Root, // recurse
            DropKey<Bag, Param> // param already supplied
          >
        }
      : {
          // — a static segment —
          [K in CamelCase<Head>]: PathToTree<`/${Rest}`, I, O, Full, Root, Bag>
        }
    : // ------ last segment ----------------------
      P extends `/${infer Leaf}`
      ? // ─ parameter leaf (rare, but handle it) ─
        Leaf extends `:${infer ParamLeaf}`
        ? {
            [K in CamelCase<ParamLeaf>]: (
              value: string
            ) => (NeedsDefault<I, O> extends true
              ? (args: I & Bag, init?: RequestInit) => Promise<O>
              : object) &
              VerbExtras<Full, Bag>
          }
        : // ─ regular leaf with verbs/get ─
          {
            [K in CamelCase<Leaf>]: (NeedsDefault<I, O> extends true
              ? (args: I & Bag, init?: RequestInit) => Promise<O>
              : object) &
              VerbExtras<Full, Bag>
          }
      : never

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never

type SimplifyDeep<T> =
  IsFn<T> extends true
    ? T
    : T extends object
      ? { [K in keyof T]: SimplifyDeep<T[K]> }
      : T

type SDKUnion = {
  [R in keyof typeof routes]: PathToTree<
    R,
    (typeof routes)[R]['input'],
    (typeof routes)[R]['output'],
    (typeof routes)[R]
  >
}[keyof typeof routes]

/* ① merge keys → object whose *values* are unions
   ② collapse every “union of functions” inside that object
   ③ turn the *remaining* union-of-objects into an intersection
   ④ prettify */
export type SDK = SimplifyDeep<
  UnionToIntersection<
    // ⟵ ③ object-level
    CollapseFnUnions<
      // ⟵ ② function-level
      MergeDeep<SDKUnion> // ⟵ ① key-level
    >
  >
>

const kebabToCamel = (seg: string) =>
  seg.replace(/-([a-z])/g, (_, c) => c.toUpperCase())

export function buildSdk(client: XOXNOClient): SDK {
  const tree: any = {}

  for (const rawPath in routes) {
    const { input, output, ...rest } = routes[rawPath as keyof typeof routes]

    const fn = (args: typeof input, init: RequestInit = {}) => {
      const paramNames = [...rawPath.matchAll(/:([a-zA-Z_]+)/g)].map(
        (m) => m[1]
      )
      const url = rawPath.replace(/:([a-zA-Z_]+)/g, (_m, p) => (args as any)[p])
      const extraArgs = Object.fromEntries(
        Object.entries(args).filter(([k]) => !paramNames.includes(k))
      )
      const hasAddress =
        /:address[^A-Z]/.test(rawPath) || 'address' in extraArgs
      const hasCollection =
        /:collection[^A-Z]/.test(rawPath) || 'collection' in extraArgs
      const addressMatch = (args as { address: string }).address
      const collectionMatch = (args as { collection: string }).collection
      if (hasAddress && !isAddressValid(addressMatch)) {
        throw new AddressNotFoundError(addressMatch)
      }
      if (
        hasCollection &&
        (Array.isArray(collectionMatch)
          ? collectionMatch.some((item) => !isValidCollectionTicker(item))
          : !isValidCollectionTicker(collectionMatch))
      ) {
        throw new CollectionNotFoundError(collectionMatch)
      }
      const extraArgsConverted =
        'filters' in extraArgs
          ? { filter: JSON.stringify(extraArgs) }
          : Object.fromEntries(
              Object.entries(extraArgs).map(([key, value]) => {
                const converted =
                  'joinArrays' in rest &&
                  rest.joinArrays &&
                  Array.isArray(value)
                    ? value.join(',')
                    : value
                return [key, converted]
              })
            )
      const { body, ...params } = extraArgsConverted
      return client.fetchWithTimeout(url, {
        ...init,
        params,
        body: Array.isArray(body) ? body[0] : body,
      }) as Promise<typeof output>
    }

    rawPath
      .split('/')
      .filter(Boolean)
      .reduce((acc, seg, i, arr) => {
        const key = kebabToCamel(seg).replace(/^:/, '')

        const nextReal = arr.slice(i + 1).find((s) => !s.startsWith(':'))
        const isLeaf = !nextReal

        if (isLeaf) {
          const leafHandler: any = (args: any) => fn(args)

          for (const verb of Object.keys(rest)) {
            if (['input', 'output', 'joinArrays'].includes(verb)) continue

            leafHandler[verb] = (verbArgs: any, init: RequestInit = {}) =>
              fn(verbArgs, {
                method: init.method ?? verb.toUpperCase(),
                ...init,
              })
          }

          acc[key] = leafHandler
        } else {
          acc = acc[key] ??= {}
        }
        return acc
      }, tree)
  }

  return tree as SDK
}

async function fn() {
  XOXNOClient.init()
  const sdk = buildSdk(XOXNOClient.getInstance())
  const result = await Promise.all([
    sdk.collection.collection('EAPES-8f3c1f').profile({}),
    // sdk.collection.collection('EAPES-8f3c1f').floorPrice({}),
    /* sdk.collection.floorPrice({
      collection: ['MICE-a0c447', 'EAPES-8f3c1f'],
      token: 'EGLD',
    }),
    sdk.collection.pinned({ chain: [ActivityChain.SUI] }),
    sdk.collection.pinnedDrops({ chain: [ActivityChain.SUI] }),
    sdk.collection.collection.pinnedDrops({ collection: 'EAPES-8f3c1f' }),
    sdk.collection.collection.pinned({ collection: 'EAPES-8f3c1f' }),
    sdk.collection.collection.profile
      .PATCH(
        {
          collection: 'EAPES-8f3c1f',
        },
        {
          headers: { Authorization: 'Bearer 123' },
          body: JSON.stringify({
            foo: 'bar',
          }),
        }
      )
      .catch(() => null),
    sdk.collection.collection.follow
      .POST(
        {
          collection: 'EAPES-8f3c1f',
        },
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
    sdk.collection.creatorTag.collectionTag.dropInfo({
      creatorTag: 'MiceCityClub',
      collectionTag: 'MiceCity',
    }), */
  ])
  console.log(result)
}

fn()
