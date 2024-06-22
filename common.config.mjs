import path from 'path';

export default {
  entry: {
    index: './src/index.ts',
    interactor: './src/interactor.ts',
    email: './src/email.tsx',
    'email-node': './src/email.tsx',
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
  optimization: {
    minimize: true,
  },
};
