/**
 * Jest configuration for AppSync resolver testing
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],

  // Transform files
  transform: {
    '^.+\\.(t|j)sx?$': 'babel-jest',
  },
  
  // Test match patterns
  testMatch: [
    '**/tests/**/*.test.js',
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Coverage configuration
  collectCoverage: false, // Disable for now
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Verbose output
  verbose: true,
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(@aws-appsync/utils)/)'
  ]
};
