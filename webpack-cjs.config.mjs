import path from 'path';
import { merge } from 'webpack-merge';
import common from './common.config.mjs';

export default merge(common, {
  mode: 'production',
  output: {
    filename: '[name].cjs.js',
    path: path.resolve('dist'),
    library: {
      type: 'commonjs2',
    },
  },
});
