export default {
  entry: {
    index: './src/index.ts',
    interactor: './src/interactor.ts',
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
  optimization: {
    minimize: true,
  },
  externals: {
    '@multiversx/sdk-core': '@multiversx/sdk-core',
    '@multiversx/sdk-network-providers': '@multiversx/sdk-network-providers',
  },
}
