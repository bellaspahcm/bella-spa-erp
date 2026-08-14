const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Read .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Error: File .env.local does not exist!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split(/\r?\n/).forEach((line) => {
  const match = line.match(/^([^#\s=]+)\s*=\s*(.*)$/);
  if (match) {
    let key = match[1].trim();
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.substring(1, val.length - 1);
    }
    envVars[key] = val;
  }
});

const SUPABASE_URL = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const SUPABASE_ANON = envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const SERVICE_KEY = envVars['SUPABASE_SERVICE_ROLE_KEY'];
const BASE_URL = 'https://bella-spa-erp.vercel.app';

if (!SUPABASE_URL || !SUPABASE_ANON || !SERVICE_KEY) {
  console.error('Error: Missing required Supabase environment variables in .env.local!');
  process.exit(1);
}

const scriptPath = process.argv[2];
if (!scriptPath) {
  console.error('Error: Please specify the k6 script path!');
  process.exit(1);
}

console.log(`Starting k6 LOCAL Run (target: Vercel Cloud SG) for ${scriptPath}...`);

// Construct command using local `k6 run`
const cmd = `k6 run ` +
  `-e BASE_URL="${BASE_URL}" ` +
  `-e SUPABASE_URL="${SUPABASE_URL}" ` +
  `-e SUPABASE_ANON_KEY="${SUPABASE_ANON}" ` +
  `-e SUPABASE_SERVICE_KEY="${SERVICE_KEY}" ` +
  `-e ENVIRONMENT="local-to-cloud" ` +
  `"${scriptPath}"`;

try {
  execSync(cmd, { stdio: 'inherit' });
} catch (error) {
  console.error('k6 local execution finished with error.');
  process.exit(1);
}
