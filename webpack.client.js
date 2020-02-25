const path = require('path');
/* eslint-disable import/no-extraneous-dependencies */
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
/* eslint-enable import/no-extraneous-dependencies */

const CSSModuleLoader = {
  loader: 'css-loader',
  options: {
    modules: true,
  },
};

const plugins = [
  new webpack.DefinePlugin({
    SERVER: false,
  }),
  new webpack.HotModuleReplacementPlugin(),
  new webpack.NoEmitOnErrorsPlugin(),
  new HtmlWebpackPlugin({
    template: 'example/index.html',
  }),
];

if (process.env.DISTRIBUTE) {
  plugins.push(new BundleAnalyzerPlugin());
}

let devTool = 'source-map';
if (process.env.SOURCEMAP) {
  devTool = process.env.SOURCEMAP;
}

const entries = ['./example/client.blop'];

if (!process.env.DISTRIBUTE) {
  entries.push('webpack-hot-middleware/client');
}

const clientConfig = {
  mode: 'development',
  devtool: devTool,
  stats: 'normal',
  target: 'web',
  entry: entries,
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
              sourceMap: !!process.env.SOURCEMAP,
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
  plugins,
};

module.exports = clientConfig;
