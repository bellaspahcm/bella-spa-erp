import type { Config } from 'jest'
import nextJest from 'next/jest.js'
 
const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})
 
// Add any custom config to be passed to Jest
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@bella/shared$': '<rootDir>/packages/shared/src/index.ts',
  },
  testMatch: [
    '<rootDir>/src/**/*.test.[jt]s?(x)',
    '<rootDir>/tests/**/*.test.[jt]s?(x)',
  ],
  // Jest chỉ scan src/. Playwright E2E nằm trong e2e/ — chạy bằng `npm run e2e`.
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/e2e/',
    '/playwright-report/',
    '/src/__tests__/e2e-(order-lifecycle-real|refund-full|accounting-gl-verification|payroll-month-close)\\.test\\.ts$',
  ],
}
 
// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config)
