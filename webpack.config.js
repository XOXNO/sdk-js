const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    index: './src/index.ts',
    interactor: './src/interactor.ts',
    email: './src/email.tsx',
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
    filename: '[name].js', // Output bundle file name
    path: path.resolve(__dirname, 'dist'),
    library: '@xoxno/sdk-js',
    libraryTarget: 'umd',
    globalObject: 'this',
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()],
  },
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM',
  },
};
