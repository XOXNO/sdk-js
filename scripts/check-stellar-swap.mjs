// Run after building. Optional arguments are installed stellar-sdk directories.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const sdkPaths = process.argv.slice(2)
if (!sdkPaths.length) {
  let sdk = dirname(require.resolve('@stellar/stellar-sdk'))
  while (!existsSync(join(sdk, 'package.json')) || JSON.parse(readFileSync(join(sdk, 'package.json'), 'utf8')).name !== '@stellar/stellar-sdk') sdk = dirname(sdk)
  sdkPaths.push(sdk)
}
const check = `
const assert = require('node:assert/strict')
const s = require('@stellar/stellar-sdk')
const { decodeStellarSwapEnvelope, decodeSwapEnvelope, getSwapRouter } = require('@xoxno/stellar-swap')
const { assertStellarAuthEntries } = require('@xoxno/sdk-js/stellar-lending')
const contract = n => s.StrKey.encodeContract(Buffer.alloc(32,n))
const viewer = s.StrKey.encodeEd25519PublicKey(Buffer.alloc(32,1))
const router = contract(1), tokenIn = contract(2), tokenOut = contract(3)
const input = '170141183460469231731687303715884105727'
const field = (key, val) => new s.xdr.ScMapEntry({key:s.xdr.ScVal.scvSymbol(key),val})
const program = Buffer.from([1,0,1,0,0,0,0,0,1,0,1,0,2,0,1])
const route = s.xdr.ScVal.scvMap([
 field('amounts',s.xdr.ScVal.scvVec([new s.ScInt('1').toI128()])),
 field('assets',s.xdr.ScVal.scvVec([tokenIn,tokenOut,contract(4)].map(a=>new s.Address(a).toScVal()))),
 field('ops',s.xdr.ScVal.scvBytes(program))
])
const op = new s.Contract(router).call('execute_strategy',new s.Address(viewer).toScVal(),new s.ScInt(input).toI128(),s.xdr.ScVal.scvBytes(Buffer.from(route.toXDR('base64'),'base64')))
const tx = new s.TransactionBuilder(new s.Account(viewer,'1'),{fee:'100',networkPassphrase:s.Networks.PUBLIC}).addOperation(op).setTimeout(0).build()
const opts = {networkPassphrase:s.Networks.PUBLIC,routerAddress:router,viewer}
for(const envelope of [tx,s.TransactionBuilder.buildFeeBumpTransaction(viewer,'100',tx,s.Networks.PUBLIC)]) assert.deepEqual(decodeStellarSwapEnvelope({...opts,envelopeXdr:envelope.toXDR()}),{tokenIn,tokenOut,amountInAtoms:input,operationIndex:0})
assert.equal(decodeStellarSwapEnvelope({...opts,envelopeXdr:'bad'}),null)
const address = a => new s.Address(a).toScVal()
const lifiOp = new s.Contract(getSwapRouter(s.Networks.PUBLIC,'lifi')).call('swap',s.xdr.ScVal.scvMap([
 field('args',s.xdr.ScVal.scvVec([address(tokenIn),address(tokenOut),new s.ScInt(input).toI128(),new s.ScInt('1').toI128(),s.xdr.ScVal.scvVec([]),address(viewer),s.nativeToScVal(1,{type:'u64'})])),
 field('fees',s.xdr.ScVal.scvVec([])), field('interface',s.xdr.ScVal.scvSymbol('soroswap_aggregator')),
 field('min_amount_out',new s.ScInt('1').toI128()),field('token_in',address(tokenIn)),field('token_out',address(tokenOut)),field('tracking_id',s.xdr.ScVal.scvString('check'))
]),address(viewer))
const xoxnoOp = new s.Contract(getSwapRouter(s.Networks.PUBLIC,'xoxno')).call('execute_strategy',address(viewer),new s.ScInt(input).toI128(),s.xdr.ScVal.scvBytes(Buffer.from(route.toXDR('base64'),'base64')))
const build = ops => ops.reduce((b,op)=>b.addOperation(op),new s.TransactionBuilder(new s.Account(viewer,'1'),{fee:'100',networkPassphrase:s.Networks.PUBLIC})).setTimeout(0).build()
for (const op of [lifiOp,xoxnoOp]) {
 const tx = build([op]); const expected = {tokenIn,tokenOut,amountInAtoms:input,operationIndex:0,provider:op===lifiOp?'lifi':'xoxno'}
 for (const envelope of [tx,s.TransactionBuilder.buildFeeBumpTransaction(viewer,'100',tx,s.Networks.PUBLIC)]) assert.deepEqual(decodeSwapEnvelope({...opts,envelopeXdr:envelope.toXDR()}),expected)
 assert.equal(decodeSwapEnvelope({...opts,viewer:contract(5),envelopeXdr:tx.toXDR()}),null)
 assert.equal(decodeSwapEnvelope({...opts,operationIndex:1,envelopeXdr:tx.toXDR()}),null)
}
const mixed = build([lifiOp,xoxnoOp]).toXDR()
assert.equal(decodeSwapEnvelope({...opts,envelopeXdr:mixed}),null)
assert.equal(decodeSwapEnvelope({...opts,envelopeXdr:mixed,operationIndex:0}).provider,'lifi')
assert.equal(decodeSwapEnvelope({...opts,envelopeXdr:mixed,operationIndex:1}).provider,'xoxno')
assert.equal(decodeSwapEnvelope({...opts,envelopeXdr:'bad'}),null)
assert.equal(decodeSwapEnvelope({...opts,networkPassphrase:'unknown',envelopeXdr:mixed}),null)

assert.throws(()=>assertStellarAuthEntries([{credentials:{type:'sorobanCredentialsAddressV2'}}],{caller:viewer,root:{contract:router,fn:'execute_strategy'},transfers:[]}),e=>e.code==='MALFORMED_TRANSACTION')
`

for (const sdkPath of sdkPaths) {
  const sdk = realpathSync(resolve(sdkPath))
  const version = JSON.parse(readFileSync(join(sdk, 'package.json'), 'utf8')).version
  const root = mkdtempSync(join(tmpdir(), 'xoxno-swap-check-'))
  try {
    const pkg = join(root, 'node_modules/@xoxno/sdk-js')
    mkdirSync(pkg, { recursive: true })
    mkdirSync(join(root, 'node_modules/@stellar'), { recursive: true })
    cpSync('dist', join(pkg, 'dist'), { recursive: true })
    cpSync('package.json', join(pkg, 'package.json'))
    const lean = join(root, 'node_modules/@xoxno/stellar-swap')
    mkdirSync(lean, {recursive:true})
    cpSync('packages/stellar-swap/dist', join(lean, 'dist'), {recursive:true})
    cpSync('packages/stellar-swap/package.json', join(lean, 'package.json'))
    symlinkSync(sdk, join(root, 'node_modules/@stellar/stellar-sdk'), 'dir')
    execFileSync(process.execPath, ['-e', check], { cwd: root, stdio: 'inherit' })
    const esm = check.replace("const assert = require('node:assert/strict')", "import assert from 'node:assert/strict'")
      .replace("const s = require('@stellar/stellar-sdk')", "import * as s from '@stellar/stellar-sdk'")
      .replace("const { decodeStellarSwapEnvelope, decodeSwapEnvelope, getSwapRouter } = require('@xoxno/stellar-swap')", "import { decodeStellarSwapEnvelope, decodeSwapEnvelope, getSwapRouter } from '@xoxno/stellar-swap'")
      .replace("const { assertStellarAuthEntries } = require('@xoxno/sdk-js/stellar-lending')", "import { assertStellarAuthEntries } from '@xoxno/sdk-js/stellar-lending'")
    execFileSync(process.execPath, ['--input-type=module', '-e', esm], { cwd: root, stdio: 'inherit' })
    const types = `import { decodeStellarSwapEnvelope, type StellarSwapEnvelopeOptions } from '@xoxno/stellar-swap'
const options: StellarSwapEnvelopeOptions = { envelopeXdr: '', networkPassphrase: '', routerAddress: '', viewer: '' }
const decoded = decodeStellarSwapEnvelope(options)
const atoms: string | undefined = decoded?.amountInAtoms
`
    for (const extension of ['mts', 'cts']) writeFileSync(join(root, `check.${extension}`), types)
    execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--noEmit', '--skipLibCheck', '--module', 'NodeNext', '--target', 'ES2022', 'check.mts', 'check.cts'], { cwd: root, stdio: 'inherit' })
    console.log(`stellar-swap ESM/CJS ok (stellar-sdk ${version})`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
