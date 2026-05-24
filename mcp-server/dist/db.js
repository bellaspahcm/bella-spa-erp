import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
// Resolve directory name in ES Module environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load .env file from the project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl) {
    throw new Error('MISSING_ENV: SUPABASE_URL environment variable is required in mcp-server/.env.');
}
if (!supabaseServiceRoleKey || supabaseServiceRoleKey === 'YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE') {
    console.warn('⚠️ [Warning] SUPABASE_SERVICE_ROLE_KEY is missing or configured with placeholder in mcp-server/.env. ' +
        'The MCP Server will start, but database operations will fail until you provide a valid Service Role Key.');
}
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey || 'MOCK_KEY', {
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
});
