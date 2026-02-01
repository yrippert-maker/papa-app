import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx', '**/__tests__/**/*.test.mjs'],
  testPathIgnorePatterns: ['/node_modules/', '/Новая папка/'],
  modulePathIgnorePatterns: ['<rootDir>/Новая папка/'],
  collectCoverageFrom: ['lib/**/*.ts', 'app/api/**/*.ts', '!**/*.d.ts'],
};

export default createJestConfig(config);
