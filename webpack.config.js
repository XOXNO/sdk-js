const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const BundleAnalyzerPlugin =
  require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

module.exports = [
  {
    mode: 'production',
    name: 'light',
    entry: './src/index.light.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].light.bundle.js',
      libraryTarget: 'umd',
      globalObject: 'this',
      library: '@xoxno/sdk-js',
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: {
            loader: 'swc-loader',
          },
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    optimization: {
      minimize: true,
      usedExports: true,
      splitChunks: {
        chunks: 'all',
      },
      minimizer: [new TerserPlugin()],
    },
    plugins: [
      new ForkTsCheckerWebpackPlugin({
        typescript: {
          configFile: 'tsconfig.json',
          diagnosticOptions: {
            semantic: true,
            syntactic: true,
          },
          mode: 'write-references', // This mode is necessary for generating .d.ts files
        },
      }),
    ],
  },
  {
    mode: 'production',
    name: 'heavy',
    entry: './src/index.large.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].heavy.bundle.js',
      libraryTarget: 'umd',
      library: '@xoxno/sdk-js',
      globalObject: 'this',
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: {
            loader: 'swc-loader',
          },
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    optimization: {
      minimize: true,
      usedExports: true,
      splitChunks: {
        chunks: 'all',
      },
      minimizer: [new TerserPlugin()],
    },
    plugins: [
      new ForkTsCheckerWebpackPlugin({
        typescript: {
          configFile: 'tsconfig.json',
          diagnosticOptions: {
            semantic: true,
            syntactic: true,
          },
          mode: 'write-references', // This mode is necessary for generating .d.ts files
        },
      }),
    ],
  },
];
