const path = require('path');

const defaultConfiguration = require('./webpack.config.cjs');

module.exports = {
  ...defaultConfiguration,
  ...{
    experiments: {
      outputModule: true,
    },
    output: {
      filename: '[name].esm.js', // Output bundle file name
      path: path.resolve(__dirname, 'dist'),
      libraryTarget: 'module',
      globalObject: 'this',
    },
  },
};