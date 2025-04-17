module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
  collectCoverage: true,
  coverageReporters: ['text', 'lcov', 'clover'],
  coverageDirectory: 'coverage',
  verbose: true
}; 