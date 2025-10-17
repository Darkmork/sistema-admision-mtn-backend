module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.js', '!src/server.js', '!src/**/*.test.js'],
  testMatch: ['**/tests/**/*.test.js', '**/src/**/*.test.js'],
  coverageThreshold: {
    global: { branches: 50, functions: 50, lines: 50, statements: 50 }
  },
  verbose: true
};
