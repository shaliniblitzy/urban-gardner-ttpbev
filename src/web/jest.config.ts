// jest.config.ts
// Jest configuration for Garden Planner web application
// Version: jest ^29.0.0

const jestConfig = {
  // Use react-native preset as base configuration
  preset: 'react-native',

  // File extensions to be processed by Jest
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js', 
    'jsx',
    'json',
    'node'
  ],

  // Setup files to run before each test
  setupFiles: [
    './node_modules/react-native-gesture-handler/jestSetup.js'
  ],

  // Patterns to ignore during transformations
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-reanimated|react-native-gesture-handler)/)'
  ],

  // Module name mapping for import aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // Pattern for test files to be executed
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$',

  // Test environment to use
  testEnvironment: 'node',

  // Enable coverage collection
  collectCoverage: true,

  // Patterns for coverage collection
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**'
  ],

  // Coverage thresholds to enforce
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};

export default jestConfig;