const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: 'development',
  entry: './public/index.blop.js',
  output: {
    path: path.resolve(__dirname, 'public', 'dist'),
    filename: 'bundle.js'
  },
  module: {
    rules: [
      {
        test: /blop\.js$/,
        use: [
          {
            loader: path.resolve('./blopLoader.js'),
            options: {/* ... */}
          }
        ]
      }
    ]
  },
  plugins: [
    new webpack.SourceMapDevToolPlugin({})
  ]
};
