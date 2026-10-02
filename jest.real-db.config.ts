import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts', '<rootDir>/jest.real-db.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '<rootDir>/src/__tests__/bella-auto-phase5-experience.test.ts',
    '<rootDir>/src/__tests__/e2e-order-lifecycle-real.test.ts',
    '<rootDir>/src/__tests__/e2e-refund-full.test.ts',
    '<rootDir>/src/__tests__/e2e-accounting-gl-verification.test.ts',
    '<rootDir>/src/__tests__/e2e-payroll-month-close.test.ts',
    '<rootDir>/src/app/api/english-center/__tests__/post-rc-real-db-validation.test.ts',
    '<rootDir>/src/__tests__/haircut-f3-debt-real-db-diagnostic.test.ts',
    '<rootDir>/src/__tests__/inventory-session-consumption-real-db.test.ts',
    '<rootDir>/src/platform/beauty/application/__tests__/beauty-history-real-db.test.ts',
    '<rootDir>/src/products/beauty-spa-v2/__tests__/beauty-spa-v2-real-db.test.ts',
  ],
}

export default createJestConfig(config)
