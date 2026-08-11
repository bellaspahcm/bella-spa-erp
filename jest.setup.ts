import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'
import dotenv from 'dotenv'
import path from 'path'

import fs from 'fs'

// Load .env.test or .env.local explicitly for tests
const envFile = fs.existsSync(path.resolve(process.cwd(), '.env.test')) ? '.env.test' : '.env.local'
dotenv.config({ path: path.resolve(process.cwd(), envFile) })

// Debug: Check if env vars are loaded (DO NOT LOG SECRET VALUES)
console.log('[Jest Setup] SUPABASE_SERVICE_ROLE_KEY loaded:', Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY));

global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder as any

if (typeof global.Request === 'undefined') {
  global.Request = class {} as any;
}
if (typeof global.Response === 'undefined') {
  global.Response = class {} as any;
}
if (typeof global.Headers === 'undefined') {
  global.Headers = class {} as any;
}

import { MetricsCollector } from './src/lib/decision-engine/MetricsCollector'

// Mock Next.js caching functions that fail in Jest environment
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));

// Disable metrics collection in Jest environment to avoid fetch failures/retries
MetricsCollector.configure({ enabled: false });
