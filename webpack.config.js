const path = require('path');
const webpack = require('webpack');

module.exports = env => {
  return {
    mode: 'development',
    stats: 'minimal',
    entry: './example/index.blop',
    output: {
      path: path.resolve(__dirname, 'example', 'dist'),
      filename: 'bundle.js'
    },
    devServer: {
      stats: 'minimal',
      contentBase: path.join(__dirname, 'example'),
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
