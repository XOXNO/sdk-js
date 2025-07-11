// Helper types for function folding

// Extract function arguments from a function type
type ExtractArgs<T> = T extends (...args: infer A) => any ? A : never

// Extract return type from a function type
type ExtractReturn<T> = T extends (...args: any[]) => infer R ? R : never

// Union to intersection helper
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never

// Check if all functions in an intersection have the same arguments
type AllHaveSameArgs<T> = T extends ((...args: infer A) => any) & infer Rest
  ? Rest extends (...args: A) => any
    ? true
    : false
  : true

// Fold function intersection into a single function with merged return types
type FoldFunctions<T> =
  AllHaveSameArgs<T> extends true
    ? T extends (...args: infer Args) => any
      ? (...args: Args) => UnionToIntersection<ExtractReturn<T>>
      : T
    : T

// Deep fold - recursively fold functions in nested objects
type DeepFoldFunctions<T> = T extends (...args: any[]) => any
  ? FoldFunctions<T>
  : T extends object
    ? { [K in keyof T]: DeepFoldFunctions<T[K]> }
    : T

// Example usage types
type ExampleBeforeFolding = {
  collection: ((val: string) => {
    profile: { method1: () => string }
  }) &
    ((val: string) => {
      floorPrice: { method2: () => number }
    })
}

type ExampleAfterFolding = DeepFoldFunctions<ExampleBeforeFolding>
// Result: {
//   collection: (val: string) => {
//     profile: { method1: () => string }
//     floorPrice: { method2: () => number }
//   }
// }

// Runtime helper function to actually merge functions
function foldFunctions<T extends Record<string, any>>(
  obj: T
): DeepFoldFunctions<T> {
  const result: any = {}

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'function') {
      // Check if this looks like an intersection of functions
      // In practice, TypeScript intersections become single functions at runtime
      // so we need to handle this differently
      result[key] = value
    } else if (value && typeof value === 'object') {
      // Recursively fold nested objects
      result[key] = foldFunctions(value)
    } else {
      result[key] = value
    }
  }

  return result as DeepFoldFunctions<T>
}

// More practical runtime helper for the SDK case
function createFoldedFunction<
  Args extends any[],
  ReturnTypes extends Record<string, any>[],
>(
  functions: ((...args: Args) => ReturnTypes[number])[]
): (...args: Args) => UnionToIntersection<ReturnTypes[number]> {
  return (...args: Args) => {
    const results = functions.map((fn) => fn(...args))

    // Merge all results into a single object
    const merged = {} as any
    for (const result of results) {
      Object.assign(merged, result)
    }

    return merged as UnionToIntersection<ReturnTypes[number]>
  }
}

// Specific helper for SDK parameter functions
function mergeSdkParameterFunctions<T extends string, R1, R2>(
  fn1: (param: T) => R1,
  fn2: (param: T) => R2
): (param: T) => R1 & R2 {
  return (param: T) => {
    const result1 = fn1(param)
    const result2 = fn2(param)

    return { ...result1, ...result2 } as R1 & R2
  }
}

// Generic helper for merging multiple parameter functions
function mergeParameterFunctions<T extends string, R extends any[]>(
  ...functions: ((param: T) => R[number])[]
): (param: T) => UnionToIntersection<R[number]> {
  return (param: T) => {
    const results = functions.map((fn) => fn(param))
    const merged = {} as any

    for (const result of results) {
      Object.assign(merged, result)
    }

    return merged as UnionToIntersection<R[number]>
  }
}

// Export all helpers
export {
  type FoldFunctions,
  type DeepFoldFunctions,
  type UnionToIntersection,
  foldFunctions,
  createFoldedFunction,
  mergeSdkParameterFunctions,
  mergeParameterFunctions,
}

// Example of how to use this for the SDK case:
/*
// Before folding:
type BeforeSDK = {
  collection: ((val: string) => { profile: Method1 }) & ((val: string) => { floorPrice: Method2 })
}

// After folding:
type AfterSDK = DeepFoldFunctions<BeforeSDK>
// Result: {
//   collection: (val: string) => { profile: Method1; floorPrice: Method2 }
// }

// Runtime usage:
const sdk = {
  collection: mergeParameterFunctions(
    (val: string) => ({ profile: method1 }),
    (val: string) => ({ floorPrice: method2 })
  )
}
*/
