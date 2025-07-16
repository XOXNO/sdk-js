import { XOXNOClient } from '../utils/api'
import { AddressNotFoundError, CollectionNotFoundError } from '../utils/errors'
import { isAddressValid } from '../utils/helpers'
import { isValidCollectionTicker } from '../utils/regex'
import { endpoints as routes } from './swagger'
import { coveredMethods, type ICoveredMethods } from './utils'

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

type RequireAtLeastOne<T> = {
  [K in keyof T]: Required<Pick<T, K>> & Partial<Omit<T, K>>
}[keyof T]

type BodyBag<VB, Defined extends boolean> = Defined extends true
  ? IsEmptyObj<VB> extends true
    ? { body?: never }
    : { body: RequireAtLeastOne<VB> }
  : { body?: RequireAtLeastOne<VB> }

// use the "auth" property when prompted
type SafeHeaders = Record<string, string> & {
  authorization?: never
  Authorization?: never
}

type OurRequestInit = Omit<RequestInit, 'body' | 'headers'> & {
  headers?: SafeHeaders
}

type SecurityModeOf<T> = T extends { securityMode: infer S } ? S : undefined

type AuthBag<M> = M extends 'optionalAny'
  ? { auth?: string }
  : M extends 'requiredAny' | 'requiredWeb2' | 'requiredJwt'
    ? { auth: string }
    : // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      { auth?: never }

type VerbExtras<Full, PBag> = {
  [Verb in keyof Full as Verb extends
    | 'input'
    | 'body'
    | 'output'
    | 'securityMode'
    ? never
    : Verb]: Full[Verb] extends { input: infer VI; output: infer VO }
    ? (
        args: VI &
          PBag &
          BodyBag<
            Full[Verb] extends { body: infer VB } ? VB : never,
            'body' extends keyof Full[Verb] ? true : false
          > &
          AuthBag<SecurityModeOf<Full[Verb]>> &
          OurRequestInit
      ) => Promise<VO>
    : never
}

type DropKey<T, K extends PropertyKey> = { [P in Exclude<keyof T, K>]: T[P] }

type RequiredKeys<T> = {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K
}[keyof T]

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
    : {
        [K in CamelCase<Head>]: PathToTree<`/${Rest}`, I, O, Full, Root, Bag>
      }
  : P extends `/:${infer Param}`
    ? {
        [K in CamelCase<Param>]: (
          value: string
        ) => (NeedsDefault<I, O> extends true
          ? HasRequiredKeys<DropKey<Bag, Param> & I> extends true
            ? (
                args: I &
                  DropKey<Bag, Param> &
                  AuthBag<SecurityModeOf<Full>> &
                  OurRequestInit
              ) => Promise<O>
            : (
                args?: I &
                  DropKey<Bag, Param> &
                  AuthBag<SecurityModeOf<Full>> &
                  OurRequestInit
              ) => Promise<O>
          : object) &
          VerbExtras<Full, DropKey<Bag, Param>>
      }
    : P extends `/${infer Leaf}`
      ? {
          [K in CamelCase<RemoveColon<Leaf>>]: (NeedsDefault<I, O> extends true
            ? HasRequiredKeys<I & Bag> extends true
              ? (
                  args: I & Bag & AuthBag<SecurityModeOf<Full>> & OurRequestInit
                ) => Promise<O>
              : (
                  args?: I &
                    Bag &
                    AuthBag<SecurityModeOf<Full>> &
                    OurRequestInit
                ) => Promise<O>
            : object) &
            VerbExtras<Full, Bag>
        }
      : never

type AnyFn = (...a: any[]) => any
type IsFn<T> = T extends AnyFn ? true : false

type U2I<U> = (U extends any ? (k: U) => 0 : never) extends (k: infer I) => 0
  ? I
  : never

type UnionKeys<U> = U extends any ? keyof U : never

type CollapseFnUnion<F> = (
  ...a: Parameters<Extract<F, AnyFn>>
) => U2I<F extends AnyFn ? ReturnType<F> : never>

type ValuesForKey<U, K extends PropertyKey> = Exclude<
  U extends any ? (K extends keyof U ? U[K] : never) : never,
  never
>

type FnUnion<U> = Extract<U, AnyFn>
type ObjUnion<U> = Exclude<U, AnyFn>

type CollapseFnUnionOrNever<U> = [FnUnion<U>] extends [never]
  ? // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    {}
  : CollapseFnUnion<FnUnion<U>>

type MergeRec<U> = [U] extends [object]
  ? {
      [K in UnionKeys<ObjUnion<U>>]: MergeRec<ValuesForKey<ObjUnion<U>, K>>
    } & CollapseFnUnionOrNever<U>
  : U

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

export type SDK = SimplifyDeep<MergeRec<SDKUnion>>

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
    const obj: any = {}

    for (const { rawPath, def } of tpl.leaves) {
      const leafKey = kebabToCamel(rawPath.split('/').pop()!.replace(/^:/, ''))
      const handler = makeLeafHandler(rawPath, def, bound, client)
      obj[leafKey] = handler
    }

    for (const [key, childTpl] of Object.entries(tpl.static)) {
      const produced = instantiate(childTpl, bound)

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

    for (const [paramKey, childTpl] of Object.entries(tpl.params)) {
      const paramFn = (value: string) => {
        const produced = instantiate(childTpl, { ...bound, [paramKey]: value })

        if (
          produced &&
          typeof produced === 'object' &&
          Object.keys(produced).length === 1 &&
          paramKey in produced &&
          typeof (produced as any)[paramKey] === 'function'
        ) {
          const leaf = (produced as any)[paramKey] as (...a: any[]) => any

          const proxy = (...a: any[]) => leaf(...a)
          Object.assign(proxy, leaf)

          return proxy
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

  const core = (
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
        k === 'filter' ? JSON.stringify(v) : Array.isArray(v) ? v.join(',') : v,
      ])
    )

    const { body, auth, ...params } = extraArgsConv

    const bodyData = body ? JSON.stringify(body) : undefined

    const Authorization = auth ? `Bearer ${auth}` : undefined

    return client.fetchWithTimeout(url, {
      ...args,
      params,
      body: bodyData,
      headers: {
        ...(args.headers as HeadersInit),
        ...(Authorization ? { Authorization } : {}),
      },
    }) as Promise<typeof _output>
  }

  const leaf: any = (args = {}) => core(args)
  for (const verb of Object.keys(rest)) {
    if (!coveredMethods.includes(verb as ICoveredMethods)) continue
    leaf[verb] = (va: any) =>
      core({ ...va, method: va.method ?? verb.toUpperCase() })
  }
  return leaf
}

async function _fn() {
  XOXNOClient.init()

  const sdk = buildSdk(XOXNOClient.getInstance())

  const result = await Promise.all([
    sdk.user.me.event.badge({ auth: '' }).catch(() => null),
    sdk.user.me.event({ extended: true, auth: '' }).catch(() => null),
    sdk.collection
      .creatorTag('MiceCityClub')
      .collectionTag('MiceCity')
      .dropInfo(),
    sdk.collection.collection('EAPES-8f3c1f').floorPrice(),
    sdk.notify.globalBroadcast
      .POST({
        body: {
          eventId: '',
        },
        auth: '',
      })
      .catch(() => null),
    sdk.user.lending.image.nonce('123')(),
    sdk.liquid.egld.staked(),
  ])

  console.log(result)
}

// _fn()
