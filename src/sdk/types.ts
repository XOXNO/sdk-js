import type { OurRequestInit } from '../utils/api'
import type { endpoints, endpoints as routes } from './swagger'

type RemoveColon<S extends string> = S extends `:${infer R}` ? R : S
type CamelCase<S extends string> = S extends `${infer Head}-${infer Tail}`
  ? `${Head}${CamelCase<Capitalize<Tail>>}`
  : S

type IsEmptyObj<T> = keyof T extends never ? true : false

type NeedsDefault<I, O, _Full> =
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
      : {}

type RequireAtLeastOne<T> = {
  [K in keyof T]-?: { [P in K]-?: T[P] } & Omit<T, K>
}[keyof T] &
  T

type BodyBag<VB, Defined extends boolean> = Defined extends true
  ? IsEmptyObj<VB> extends true
    ? { body?: never }
    : { body: RequireAtLeastOne<VB> }
  : { body?: RequireAtLeastOne<VB> }

type SecurityModeOf<T> = T extends { securityMode: infer S } ? S : undefined

type AuthBag<M> = M extends 'optionalAny'
  ? { auth?: string }
  : M extends 'requiredAny' | 'requiredWeb2' | 'requiredJwt'
    ? { auth: string }
    : { auth?: never }

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
        [K in CamelCase<Param>]: (value: string) => (NeedsDefault<
          I,
          O,
          Full
        > extends true
          ? HasRequiredKeys<
              DropKey<Bag, Param> & I & AuthBag<SecurityModeOf<Full>>
            > extends true
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
          : {}) &
          VerbExtras<Full, DropKey<Bag, Param>>
      }
    : P extends `/${infer Leaf}`
      ? {
          [K in CamelCase<RemoveColon<Leaf>>]: (NeedsDefault<
            I,
            O,
            Full
          > extends true
            ? HasRequiredKeys<
                I & Bag & AuthBag<SecurityModeOf<Full>>
              > extends true
              ? (
                  args: I & Bag & AuthBag<SecurityModeOf<Full>> & OurRequestInit
                ) => Promise<O>
              : (
                  args?: I &
                    Bag &
                    AuthBag<SecurityModeOf<Full>> &
                    OurRequestInit
              ) => Promise<O>
            : {}) &
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
  ? {}
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

export type SDKTags = {
  [K in keyof typeof endpoints]: IsEmptyObj<
    (typeof endpoints)[K]['input']
  > extends true
    ? IsEmptyObj<(typeof endpoints)[K]['output']> extends true
      ? never
      : K
    : K
}[keyof typeof endpoints]
