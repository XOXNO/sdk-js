import path from 'path'

import { merge } from 'webpack-merge'

import common from './common.config.mjs'

// The root entry ships as one ESM file per source module (build:esm runs swc; see
// scripts/emit-esm-entries.mjs) so consumers tree-shake the Stellar builders and their
// `@stellar/stellar-sdk` import away. The Stellar subpaths stay single-file bundles:
// importing them means wanting the Stellar surface.
const { index: _rootEntry, ...stellarEntries } = common.entry

export default merge({ ...common, entry: stellarEntries }, {
  mode: 'production',
  // ESM output: emit a real `import ... from '@stellar/stellar-sdk'` for the
  // externalized dependency so the consumer's bundler/runtime resolves it.
  externalsType: 'module',
  output: {
    filename: '[name].esm.js',
    path: path.resolve('dist'),
    library: {
      type: 'module',
    },
  },
  experiments: {
    outputModule: true,
  },
})
