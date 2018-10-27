const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: 'development',
  entry: './public/index.blop',
  output: {
    path: path.resolve(__dirname, 'public', 'dist'),
    filename: 'bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.blop$/,
        use: [
          {
            loader: path.resolve('./blopLoader.js'),
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
