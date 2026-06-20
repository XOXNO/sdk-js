// Emit a CommonJS-flavored copy of the per-file `.d.ts` tree under `dist/cjs/`.
//
// The package is `"type": "module"`, so every `tsc`-emitted `.d.ts` in `dist/`
// is an ESM declaration. CommonJS consumers (e.g. Azure Functions on
// `moduleResolution: node16`) resolve the `exports["."].require.types`
// condition and would otherwise be handed an ESM `.d.ts` — which TypeScript
// refuses to `require` (TS1479) and whose re-exports it cannot resolve as CJS
// (TS2305).
//
// `dts-bundle-generator` (the previous fix, see git history) crashes on
// stellar-sdk v16's `xdr.ScVal` types, so we cannot bundle. Instead we copy the
// per-file declarations verbatim into `dist/cjs/` and drop a
// `{"type":"commonjs"}` marker there: the nearest package.json makes Node/TS
// interpret that whole subtree as CommonJS, so the identical declarations now
// resolve their relative re-exports as CJS. `exports["."].require.types` points
// at `dist/cjs/index.d.ts`; the ESM `import` condition keeps using `dist/`.

import { readdirSync, mkdirSync, copyFileSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'

const DIST = 'dist'
const CJS_DIR = join(DIST, 'cjs')

function walk(dir, onFile) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (full === CJS_DIR) continue // never recurse into our own output
    if (statSync(full).isDirectory()) walk(full, onFile)
    else onFile(full)
  }
}

mkdirSync(CJS_DIR, { recursive: true })

let copied = 0
walk(DIST, (file) => {
  if (!file.endsWith('.d.ts')) return
  const rel = file.slice(DIST.length + 1) // path relative to dist/
  const out = join(CJS_DIR, rel)
  mkdirSync(dirname(out), { recursive: true })
  copyFileSync(file, out)
  copied++
})

writeFileSync(join(CJS_DIR, 'package.json'), `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`)

console.log(`emit-cjs-dts: copied ${copied} .d.ts file(s) into ${CJS_DIR}/ + {"type":"commonjs"} marker`)
