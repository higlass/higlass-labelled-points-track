module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  testMatch: ['**/test/**/*.test.js'],
  moduleFileExtensions: ['js'],
  collectCoverageFrom: ['src/**/*.js'],
};
