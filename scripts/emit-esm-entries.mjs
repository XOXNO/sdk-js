// The root ESM entry is one file per source module (dist/esm/**), so a consumer's bundler can drop modules it
// never imports: the Stellar builders and their `@stellar/stellar-sdk` import stay out of a page that only
// uses readers. This entry file keeps the published path in package.json `exports` unchanged.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, relative } from 'node:path'

const entries = {
  'dist/index.esm.js': 'dist/esm/index.js',
}

for (const [entry, target] of Object.entries(entries)) {
  mkdirSync(dirname(entry), { recursive: true })
  writeFileSync(entry, `export * from './${relative(dirname(entry), target)}'\n`)
}
