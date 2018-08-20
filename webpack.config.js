const path = require('path');

module.exports = {
  mode: 'development',
  entry: './public/test.blop.js',
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
  }
};
