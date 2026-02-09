import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx', '**/__tests__/**/*.test.mjs'],
  testPathIgnorePatterns: ['/node_modules/', '/Новая папка/', '/Новая папка с объектами/', '__tests__/scripts/independent-verify.test.mjs'],
  modulePathIgnorePatterns: ['<rootDir>/Новая папка/', '<rootDir>/Новая папка с объектами/'],
  watchPathIgnorePatterns: ['/Новая папка/', '/Новая папка с объектами/'],
  collectCoverageFrom: ['lib/**/*.ts', 'app/api/**/*.ts', '!**/*.d.ts'],
  coverageThreshold: {
    global: {
      branches: 1,
      functions: 1,
      lines: 1,
      statements: 1,
    },
  },
};

export default createJestConfig(config);
