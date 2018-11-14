const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: 'development',
  entry: './public/index.blop',
  output: {
    path: path.resolve(__dirname, 'public', 'dist'),
    filename: 'bundle.js'
  },
  devServer: {
    contentBase: path.join(__dirname, 'public'),
    index: 'index.html',
    port: 9000
  },
  module: {
    rules: [
      {
        test: /\.blop$/,
        use: [
          {
            loader: path.resolve('./src/blopLoader.js'),
            options: {debug: false}
          }
        ]
      }
    ]
  },
  plugins: [
    new webpack.SourceMapDevToolPlugin({})
  ]
};
