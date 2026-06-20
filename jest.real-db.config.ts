import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '<rootDir>/src/__tests__/e2e-order-lifecycle-real.test.ts',
    '<rootDir>/src/__tests__/e2e-refund-full.test.ts',
    '<rootDir>/src/__tests__/e2e-accounting-gl-verification.test.ts',
    '<rootDir>/src/__tests__/e2e-payroll-month-close.test.ts',
  ],
}

export default createJestConfig(config)
