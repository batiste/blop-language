const path = require('path');
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');

const serverConfig = {
  mode: 'development',
  stats: 'minimal',
  target: 'node',
  externals: [nodeExternals()],
  entry: './example/server.blop',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'server.js',
  },
  module: {
    rules: [
      {
        test: /\.blop$/,
        use: [
          {
            loader: path.resolve('./src/loader.js'),
            options: { debug: !!process.env.BLOP_DEBUG },
          },
        ],
      },
    ],
  },
  plugins: [
    new webpack.SourceMapDevToolPlugin({}),
    new webpack.DefinePlugin({
      SERVER: true,
    }),
  ],
};

const clientConfig = {
  mode: 'development',
  stats: 'minimal',
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
            options: { debug: !!process.env.BLOP_DEBUG },
          },
        ],
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

module.exports = [serverConfig, clientConfig];
