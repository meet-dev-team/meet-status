module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'build.js',
    'script.js',
    '!node_modules/**',
    '!coverage/**'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true
};
