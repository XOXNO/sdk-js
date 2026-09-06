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
// per-file declarations (with NodeNext-compatible imports) into `dist/cjs/` and drop a
// `{"type":"commonjs"}` marker there: the nearest package.json makes Node/TS
// interpret that whole subtree as CommonJS, so the identical declarations now
// resolve their relative re-exports as CJS. `exports["."].require.types` points
// at `dist/cjs/index.d.ts`; the ESM `import` condition keeps using `dist/`.

import { readdirSync, mkdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import ts from 'typescript'

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

// NodeNext requires explicit .js specifiers in ESM declarations. TypeScript
// resolves them to the corresponding .d.ts; directory barrels need /index.js.
function resolveEsmImports(file) {
  const source = readFileSync(file, 'utf8')
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const edits = []
  function visit(node) {
    const specifier = ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
      ? node.moduleSpecifier
      : ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)
        ? node.argument.literal : undefined
    if (specifier && ts.isStringLiteral(specifier) && /^\.\.?\//.test(specifier.text)) {
      const target = join(dirname(file), specifier.text)
      const suffix = existsSync(`${target}.d.ts`) ? '.js'
        : existsSync(join(target, 'index.d.ts')) ? '/index.js' : ''
      if (suffix) edits.push([specifier.getStart(ast) + 1, specifier.getEnd() - 1, specifier.text + suffix])
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return edits.sort((a, b) => b[0] - a[0]).reduce(
    (text, [start, end, value]) => text.slice(0, start) + value + text.slice(end), source,
  )
}

let copied = 0
walk(DIST, (file) => {
  if (!file.endsWith('.d.ts')) return
  const rel = file.slice(DIST.length + 1) // path relative to dist/
  const out = join(CJS_DIR, rel)
  mkdirSync(dirname(out), { recursive: true })
  const declaration = resolveEsmImports(file)
  writeFileSync(file, declaration)
  writeFileSync(out, declaration)
  copied++
})

writeFileSync(join(CJS_DIR, 'package.json'), `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`)

console.log(`emit-cjs-dts: copied ${copied} .d.ts file(s) into ${CJS_DIR}/ + {"type":"commonjs"} marker`)
