import webpack from 'webpack'

export default {
  entry: {
    index: './src/index.ts',
  },
  plugins: [
    // Polyfill `self` for Node.js / Edge consumers. The SDK and its
    // nested deps (notably `@stellar/stellar-sdk/dist/stellar-sdk.min.js`)
    // are pre-built UMD bundles that reference `self` at module-eval time.
    // Prepending this banner guarantees `self` is defined before any
    // nested UMD wrapper runs, regardless of runtime (browser, Node.js,
    // Next.js middleware, Server Components, build-time page workers).
    new webpack.BannerPlugin({
      banner:
        'if(typeof globalThis!=="undefined"&&typeof globalThis.self==="undefined"){globalThis.self=globalThis;}',
      raw: true,
      entryOnly: true,
    }),
  ],
  // Leave `@stellar/stellar-sdk` (and any subpath) out of the bundle so the
  // SDK uses the CONSUMER's copy. Bundling it inlines a second copy of
  // stellar-base, whose `Transaction`/`Account`/`xdr` classes then differ
  // from the consumer's by reference — `rpc.Server.prepareTransaction` runs
  // `instanceof Transaction` against the consumer's class and throws
  // "expected a 'Transaction', got: [object Object]". It is declared a
  // peerDependency; both consumers (xoxno-api-v2, xoxno-az-functions) and the
  // UI already depend on it directly. `externalsType` is set per build
  // (`module` for ESM, `commonjs` for CJS).
  externals: {
    '@stellar/stellar-sdk': '@stellar/stellar-sdk',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      fs: false,
      crypto: false,
      stream: false,
      path: false,
    },
  },
  output: {
    // Use `globalThis` instead of the default `self`. `self` is
    // undefined in Node.js / Edge runtimes, which crashes imports
    // from Next.js middleware, route handlers, Server Components,
    // and the build-time page-data collector.
    globalObject: 'globalThis',
  },
  optimization: {
    minimize: true,
  },
}
