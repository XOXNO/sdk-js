import path from 'path'

import { merge } from 'webpack-merge'

import common from './common.config.mjs'

export default merge(common, {
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
