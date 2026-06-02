import path from 'path'

import { merge } from 'webpack-merge'

import common from './common.config.mjs'

export default merge(common, {
  mode: 'production',
  output: {
    // `.cjs` (not `.cjs.js`) so Node interprets it as CommonJS under the
    // package's `"type": "module"` — otherwise `require()` of the SDK from a
    // CJS consumer loads commonjs2 output as ESM and throws ERR_REQUIRE_ESM.
    filename: '[name].cjs',
    path: path.resolve('dist'),
    library: {
      type: 'commonjs2',
    },
  },
})
