import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'
import dotenv from 'dotenv'
import path from 'path'

// Load .env.local explicitly for tests
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// Debug: Check if env vars are loaded
console.log('[Jest Setup] SUPABASE_SERVICE_ROLE_KEY loaded:', 
  process.env.SUPABASE_SERVICE_ROLE_KEY ? 
  `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 12)}... (${process.env.SUPABASE_SERVICE_ROLE_KEY.length} chars)` : 
  'NOT LOADED'
)

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
