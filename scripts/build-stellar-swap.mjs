import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, writeFileSync } from 'node:fs'

for (const format of ['cjs', 'esm']) execFileSync('./node_modules/.bin/webpack', [
  '--config', `webpack-${format}.config.mjs`, '--entry-reset', '--entry', './src/sdk/stellar/swap-index.ts',
  '--output-filename', `sdk/stellar/swap-index.${format === 'cjs' ? 'cjs' : 'esm.js'}`,
], { stdio: 'inherit' })
execFileSync('npm', ['run', 'build:types'], { stdio: 'inherit' })
const target = 'packages/stellar-swap/dist'
mkdirSync(`${target}/cjs`, { recursive: true })
for (const name of ['swap-index.cjs', 'swap-index.cjs.LICENSE.txt', 'swap-index.esm.js', 'swap-index.esm.js.LICENSE.txt', 'swap-index.d.ts', 'swap-history.d.ts'])
  cpSync(`dist/sdk/stellar/${name}`, `${target}/${name}`)
for (const name of ['swap-index.d.ts', 'swap-history.d.ts']) cpSync(`${target}/${name}`, `${target}/cjs/${name}`)
writeFileSync(`${target}/cjs/package.json`, '{"type":"commonjs"}\n')
