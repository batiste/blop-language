const path = require('path');
const webpack = require('webpack');

module.exports = env => {
  return {
    mode: 'development',
    stats: 'minimal',
    entry: './public/index.blop',
    output: {
      path: path.resolve(__dirname, 'public', 'dist'),
      filename: 'bundle.js'
    },
    devServer: {
      stats: 'minimal',
      contentBase: path.join(__dirname, 'public'),
      index: 'index.html',
      historyApiFallback: {
        rewrites: [
          { from: /^\/dogs\/.*/, to: '/index.html' },
        ]
      },
      port: 9000,
      overlay: true,
      watchContentBase: true
    },
    module: {
      rules: [
        {
          test: /\.blop$/,
          use: [
            {
              loader: path.resolve('./src/loader.js'),
              options: {debug: !!process.env.BLOP_DEBUG}
            }
          ]
        }
      ]
    },
    plugins: [
      new webpack.SourceMapDevToolPlugin({})
    ]
  }
};
