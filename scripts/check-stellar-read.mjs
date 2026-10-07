// Verify the published subpath without a Stellar installation or Node globals.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const context = vm.createContext({ URL })
const esm = new vm.SourceTextModule(readFileSync('dist/sdk/stellar/read/index.esm.js', 'utf8'), { context })
await esm.link(specifier => { throw new Error(`Unexpected read runtime import: ${specifier}`) })
await esm.evaluate()
assert.equal(typeof esm.namespace.createStellarLendingReadClient, 'function')
assert.equal(vm.runInContext('typeof process', context), 'undefined')
assert.equal(vm.runInContext('typeof Buffer', context), 'undefined')
assert.equal(vm.runInContext('typeof self', context), 'undefined')
const response = { ok: true, status: 200, headers: { get: () => null }, json: async () => [] }
assert.deepEqual(Array.from(await esm.namespace.createStellarLendingReadClient({
  baseUrl: 'https://api.example', fetch: async () => response,
}).positions('GOWNER')), [])

const root = mkdtempSync(join(tmpdir(), 'xoxno-read-check-'))
try {
  const pkg = join(root, 'node_modules/@xoxno/sdk-js')
  mkdirSync(pkg, { recursive: true })
  cpSync('package.json', join(pkg, 'package.json'))
  for (const path of ['dist/sdk/stellar/read', 'dist/cjs/sdk/stellar/read']) {
    mkdirSync(join(pkg, path), { recursive: true })
    cpSync(path, join(pkg, path), { recursive: true })
  }
  cpSync('dist/cjs/package.json', join(pkg, 'dist/cjs/package.json'))
  const check = `const read = require('@xoxno/sdk-js/stellar-lending/read');
    if (typeof read.createStellarLendingReadClient !== 'function') throw new Error('CJS read export missing')`
  execFileSync(process.execPath, ['-e', check], { cwd: root, stdio: 'inherit' })
  execFileSync(process.execPath, ['--input-type=module', '-e', check.replace(
    "const read = require('@xoxno/sdk-js/stellar-lending/read')", "import * as read from '@xoxno/sdk-js/stellar-lending/read'",
  )], { cwd: root, stdio: 'inherit' })
  const types = `import { createStellarLendingReadClient, lendingPositionsSchema,
    type LendingAsset, type LendingPosition, type LendingAssetUsage } from '@xoxno/sdk-js/stellar-lending/read'
    const usage: LendingAssetUsage = 'borrow'
    const client = createStellarLendingReadClient({ baseUrl: 'https://api.example' })
    const assets: Promise<LendingAsset[]> = client.assets({ usage })
    const positions: Promise<LendingPosition[]> = client.positions('GOWNER')
    const raw: 'string' = lendingPositionsSchema.items.properties.supplied.items.properties.amountRaw.type
  `
  for (const extension of ['mts', 'cts']) writeFileSync(join(root, `check.${extension}`), types)
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--noEmit', '--strict', '--module', 'NodeNext', '--target', 'ES2022', '--lib', 'ES2022,DOM', 'check.mts', 'check.cts'], { cwd: root, stdio: 'inherit' })
} finally {
  rmSync(root, { recursive: true, force: true })
}
console.log('Stellar REST read ESM/CJS and declarations work without Stellar dependencies or Node globals')
