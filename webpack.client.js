const path = require('path');
/* eslint-disable import/no-extraneous-dependencies */
const webpack = require('webpack');
/* eslint-enable import/no-extraneous-dependencies */

const clientConfig = {
  mode: 'development',
  devtool: 'eval-source-map',
  stats: 'normal',
  target: 'web',
  entry: './example/client.blop',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'client.js',
  },
  module: {
    rules: [
      {
        test: /\.blop$/,
        use: [
          {
            loader: path.resolve('./src/loader.js'),
            options: {
              debug: !!process.env.BLOP_DEBUG,
              sourceMap: true,
              strictness: 'perfect',
            },
          },
        ],
      },
      {
        test: /\.css$/i,
        use: ['css-loader'],
      },
    ],
  },
  plugins: [
    new webpack.SourceMapDevToolPlugin({}),
    new webpack.DefinePlugin({
      SERVER: false,
    }),
  ],
};

module.exports = clientConfig;
