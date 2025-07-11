import { ActivityChain } from '@xoxno/types/dist/common/enums'

import { XOXNOClient } from '../utils/api'
import { AddressNotFoundError, CollectionNotFoundError } from '../utils/errors'
import { isAddressValid } from '../utils/helpers'
import { isValidCollectionTicker } from '../utils/regex'
import { routes } from './endpoints'

type SegKey<S extends string> = S extends `:${infer P}` ? never : S
type SegParam<S extends string> = S extends `:${infer P}` ? P : never

type RemoveColon<S extends string> = S extends `:${infer R}` ? R : S

type CamelCase<S extends string> =
  S extends `${infer H}-${infer T}${infer Rest}`
    ? `${H}${Capitalize<`${T}${Rest}`>}`
    : S

type IsEmptyObj<T> = keyof T extends never ? true : false

type NeedsDefault<I, O> =
  IsEmptyObj<I> extends true
    ? IsEmptyObj<O> extends true
      ? false // both empty → skip default
      : true
    : true

/** "/a/:x/b/:y" → { x: string, y: string } */
type CollectParams<S extends string> =
  S extends `${string}:${infer P}/${infer R}`
    ? { [K in P]: string } & CollectParams<`/${R}`>
    : S extends `${string}:${infer P}`
      ? { [K in P]: string }
      : object

type VerbExtras<Full, _unused = {}> = {
  [M in keyof Full as M extends 'input' | 'output' | 'joinArrays'
    ? never
    : M]: Full[M] extends { input: infer VI; output: infer VO }
    ? (args: VI & { body?: string }, init?: RequestInit) => Promise<VO>
    : never
}

type PathToTree<P extends string, I, O, Full> =
  /* ── more segments ahead ── */
  P extends `/${infer Head}/${infer Rest}`
    ? SegParam<Head> extends never
      ? /* normal segment → object property */
        { [K in CamelCase<Head>]: PathToTree<`/${Rest}`, I, O, Full> }
      : /* param segment  → curried function */
        (val: string) => PathToTree<`/${Rest}`, I, O, Full>
    : /* ── leaf ── */
      P extends `/${infer Leaf}`
      ? SegParam<Leaf> extends never
        ? { [K in CamelCase<Leaf>]: DefaultAndVerbs<I, O, Full> }
        : (val: string) => DefaultAndVerbs<I, O, Full>
      : never

/* helper to attach default GET (if needed) + verbs */
type DefaultAndVerbs<I, O, Full> = (NeedsDefault<I, O> extends true
  ? (input: I, init?: RequestInit) => Promise<O>
  : {}) &
  VerbExtras<Full, {}>

type SDKUnion = {
  [P in keyof typeof routes]: PathToTree<
    P,
    (typeof routes)[P]['input'],
    (typeof routes)[P]['output'],
    (typeof routes)[P]
  >
}[keyof typeof routes]

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never

type SDKIntersection = UnionToIntersection<SDKUnion>

type IsFn<T> = T extends (...args: any[]) => any ? true : false

type SimplifyDeep<T> =
  IsFn<T> extends true
    ? T
    : T extends object
      ? { [K in keyof T]: SimplifyDeep<T[K]> }
      : T

export type SDK = SimplifyDeep<SDKIntersection>

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
      const hasAddress = rawPath.includes(':address') || 'address' in extraArgs
      const hasCollection =
        rawPath.includes(':collection') || 'collection' in extraArgs
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
    sdk.collection('EAPES-8f3c1f').profile({}),
    sdk.collection('EAPES-8f3c1f').floorPrice({}),
    sdk.collection.floorPrice({
      collection: ['MICE-a0c447', 'EAPES-8f3c1f'],
      token: 'EGLD',
    }),
    sdk.collection.pinned({ chain: [ActivityChain.SUI] }),
    sdk.collection.pinnedDrops({ chain: [ActivityChain.SUI] }),
    sdk.collection('EAPES-8f3c1f').pinnedDrops({}),
    sdk.collection('EAPES-8f3c1f').pinned({}),
    sdk
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
    sdk
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
  ])
  console.log(result)
}

fn()
