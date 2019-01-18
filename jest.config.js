// jest.config.js
module.exports = {
  moduleFileExtensions: [
    'blop',
    'js',
  ],
  testMatch: ['**/*.test.blop'],
  transform: {
    '^.+\\.blop$': './src/jest.js',
  },
};
