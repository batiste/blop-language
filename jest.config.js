// jest.config.js
module.exports = {
  moduleFileExtensions: [
    'blop',
    'js',
  ],
  testMatch: ['**/*.test.blop', '**/tests/**/*.test.js'],
  transform: {
    '^.+\\.blop$': './src/jest.js',
    '^.+\\.js$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(snabbdom)/)',
  ],
  moduleNameMapper: {
    '^.*/runtime\\.js$': '<rootDir>/src/runtime.mock.js',
  },
  testEnvironment: 'jsdom',
  collectCoverage: false, // Set to true to enable coverage
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**',
    '!src/parser.js', // Generated file
    '!src/blop.js', // CLI entry point
    '!src/generateParser.js',
    '!src/updateAutocompleteFile.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },};
