import type { Config } from 'jest'; // jest ^29.0.0

const config: Config = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',
  
  // Set Node.js as test environment
  testEnvironment: 'node',
  
  // Define root directory for tests
  roots: ['<rootDir>/src'],
  
  // Test file patterns to match
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  
  // TypeScript transformation configuration
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  
  // File extensions to consider
  moduleFileExtensions: [
    'ts',
    'js', 
    'json',
    'node'
  ],
  
  // Module path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // Enable code coverage collection
  collectCoverage: true,
  
  // Coverage output directory
  coverageDirectory: 'coverage',
  
  // Coverage report formats
  coverageReporters: [
    'text',
    'lcov',
    'clover'
  ],
  
  // Coverage thresholds - require 80% coverage across all metrics
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Paths to ignore during testing
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Enable verbose test output
  verbose: true,
  
  // Test timeout in milliseconds
  testTimeout: 30000,
  
  // Limit parallel test execution to 50% of available CPU cores
  maxWorkers: '50%'
};

export default config;