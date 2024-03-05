/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    index: {
      import: './src/index.ts',
    },
    launchpad: {
      import: './src/launchpad/index.ts',
    },
    interactions: {
      import: './src/interactions/index.ts',
    },
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
  },
  output: {
    filename: '[name].bundle.js', // Output bundle file name
    path: path.resolve(__dirname, 'dist'),
    library: '@xoxno/sdk-js',
    libraryTarget: 'umd',
    globalObject: 'this',
  },
  optimization: {
    minimize: true, 
    splitChunks: {
      chunks: 'all',
    }, 
    minimizer: [new TerserPlugin()],
  },
};
