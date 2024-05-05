import { config } from '@swc/core/spack';

export default config({
  entry: {
    web: __dirname + '/src/index.ts',
    android: __dirname + '/src/index.large.ts',
  },
  output: {
    path: __dirname + '/lib',
  },
  mode: 'production',
});
