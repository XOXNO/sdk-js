import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/* -------------------------------------------------------------------------- */
/*                               small helpers                                */
/* -------------------------------------------------------------------------- */

function sliceBlock(src: string, startIdx: number): string {
  let depth = 0
  for (let i = startIdx; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) return src.slice(startIdx, i + 1)
    }
  }
  return ''
}

function hasTypedIO(block: string): boolean {
  const mIn = block.match(/"input"\s*:\s*{\s*}(?:\s*as\s+[^,\n]+)?/)
  const mOut = block.match(/"output"\s*:\s*{\s*}(?:\s*as\s+[^,\n]+)?/)
  if (!mIn || !mOut) return false // malformed  → skip
  return mIn[0].includes(' as ') || mOut[0].includes(' as ')
}

/** Extract the output type used with `as SomeType` – returns null if none found. */
function getReturnType(block: string): string | null {
  const mOut = block.match(/"output"\s*:\s*{\s*}\s*as\s+([^,\n]+)/)
  return mOut ? mOut[1].trim() : null
}

const SUB_METHODS = ['"POST"', '"PATCH"', '"PUT"', '"DELETE"']

/* -------------------------------------------------------------------------- */
/*                         endpoint collection (v2)                           */
/* -------------------------------------------------------------------------- */

type Endpoint = [method: string, path: string, returnType?: string | null]

function collectEndpoints(src: string): Endpoint[] {
  const endpoints: Endpoint[] = [] // [METHOD, /path, returnType]

  function walk(path: string, block: string, method: string) {
    if (hasTypedIO(block)) {
      if (!path.startsWith('/')) return
      endpoints.push([method, path, getReturnType(block)])
    }
    for (const key of SUB_METHODS) {
      const re = new RegExp(`${key}\\s*:\\s*{`)
      const m = re.exec(block)
      if (!m) continue
      const subBlock = sliceBlock(block, m.index + m[0].indexOf('{'))
      walk(path, subBlock, key.replace(/"/g, ''))
    }
  }

  const topRE = /"([^"]+)"\s*:\s*{/g
  let m: RegExpExecArray | null
  while ((m = topRE.exec(src))) {
    const path = m[1]
    const blockStart = m.index + m[0].indexOf('{')
    const block = sliceBlock(src, blockStart)
    walk(path, block, 'GET') // default verb
  }
  return endpoints
}

/* -------------------------------------------------------------------------- */
/*                 path → sdk.xxx transformation logic                        */
/* -------------------------------------------------------------------------- */

const toCamel = (s: string) =>
  s
    .split(/[-_]/)
    .map((p, i) => (i ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join('')

function buildSdkCall(
  method: string,
  rawPath: string,
  returnType?: string | null
): string {
  const segs = rawPath.split('/').filter(Boolean) // drop leading ""
  const chain: string[] = ['sdk']

  // build dotted chain
  segs.forEach((seg, idx) => {
    const isLast = idx === segs.length - 1
    const isDynamic = seg.startsWith(':')
    const camelSeg = toCamel(isDynamic ? seg.slice(1) : seg)
    if (isDynamic) {
      chain.push(`${camelSeg}("...")`) // always fn call
    } else {
      chain.push(camelSeg) // plain prop
    }

    // GET special‑case on last segment
    if (isLast && method === 'GET') {
      if (!isDynamic) {
        chain[chain.length - 1] += '(...)' // static → add ()
      } else chain.push('(...)') // dynamic already (param) → add 2nd call
    }
  })

  // non‑GET methods
  if (method !== 'GET') chain.push(`${method}(...);`)
  else chain[chain.length - 1] += ';'

  let call = chain.join('.').replace(').(', ')(')
  if (returnType) call += ` // ${returnType}`
  return call
}

/* -------------------------------------------------------------------------- */
/*                                   main                                     */
/* -------------------------------------------------------------------------- */

const rawTxt = readFileSync(
  join(process.cwd(), './src/md/transformed.txt'),
  'utf8'
)

// dedupe by METHOD+PATH while keeping first returnType encountered
const unique = new Map<string, Endpoint>()
for (const ep of collectEndpoints(rawTxt)) {
  const key = `${ep[0]}|${ep[1]}`
  if (!unique.has(key)) unique.set(key, ep)
}
const entries = Array.from(unique.values()).sort((a, b) =>
  (a[0] + a[1]).localeCompare(b[0] + b[1])
)

const lines: string[] = []

for (const [method, path, returnType] of entries) {
  lines.push(`// ${method} ${path}`)
  lines.push(buildSdkCall(method, path, returnType))
  lines.push('') // empty line
}

writeFileSync(
  join(process.cwd(), './README.md'),
  `${readFileSync(join(process.cwd(), './src/md/template.md'), 'utf8')}
\`\`\`typescript
${lines.join('\n')}\n\`\`\``,
  'utf8'
)
console.log('transformed.md written ✓')
