const path = require('path');
/* eslint-disable import/no-extraneous-dependencies */
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
/* eslint-enable import/no-extraneous-dependencies */

const CSSModuleLoader = {
  loader: 'css-loader',
  options: {
    modules: true,
  },
};

const clientConfig = {
  mode: 'development',
  devtool: 'eval-source-map',
  stats: 'normal',
  target: 'web',
  entry: ['./example/client.blop', 'webpack-hot-middleware/client'],
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: './',
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
        use: ['style-loader', CSSModuleLoader],
      },
      {
        test: /\.scss$/,
        use: ['style-loader', CSSModuleLoader, 'sass-loader'],
      },
    ],
  },
  plugins: [
    new webpack.SourceMapDevToolPlugin({}),
    new webpack.DefinePlugin({
      SERVER: false,
    }),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
    new HtmlWebpackPlugin({
      template: 'example/index.html',
    }),
  ],
};

module.exports = clientConfig;
