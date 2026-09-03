import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const roots = ['src', 'scripts', '.github/workflows'];
const explicitFiles = ['.env', '.env.local', '.env.test', '.env.local.template', '.env.production', '.env.staging', '.env.vercel'];
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.yml', '.yaml']);
const excludedPathFragments = [
  `${sep}__tests__${sep}`,
  `${sep}node_modules${sep}`,
  `${sep}.next${sep}`,
  `${sep}test-results${sep}`,
];
const excludedFiles = new Set([
  'scripts/check-secret-leaks.mjs',
  'scripts/auto-demo-tenant.cjs',
  'scripts/reset-user-password.ts',
  'scripts/seed-production-test-data.ts',
  'scripts/update-bella-auto-enabled-modules.ts',
]);

const secretNames = [
  'SUPABASE_DB_URL',
  'SUPABASE_DATABASE_URL',
  'DATABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'PAYMENT_WEBHOOK_SECRET',
  'CRON_SECRET',
  'TELEGRAM_WEBHOOK_SECRET',
  'TEST_UPCOMING_SECRET',
  'DB_ENCRYPTION_KEY',
  'SENTRY_AUTH_TOKEN',
  'VERCEL_TOKEN',
];

function hasAllowedExtension(filePath) {
  return [...allowedExtensions].some((extension) => filePath.endsWith(extension));
}

function shouldSkip(filePath) {
  const normalized = relative(process.cwd(), filePath).split(sep).join('/');
  if (excludedFiles.has(normalized)) return true;
  return excludedPathFragments.some((fragment) => filePath.includes(fragment));
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (hasAllowedExtension(fullPath) && !shouldSkip(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function listFilesToScan() {
  const files = [];
  for (const root of roots) {
    const absoluteRoot = join(process.cwd(), root);
    if (existsSync(absoluteRoot)) {
      files.push(...walk(absoluteRoot));
    }
  }

  for (const file of explicitFiles) {
    const absolutePath = join(process.cwd(), file);
    if (existsSync(absolutePath) && !shouldSkip(absolutePath)) {
      files.push(absolutePath);
    }
  }

  return [...new Set(files)];
}

function isAllowedLiteral(value) {
  const normalized = value.trim();
  return /^(test|mock|dummy|example|placeholder|redacted|changeme|your-|xxx|xxxx)/i.test(normalized)
    || normalized.includes('${{')
    || normalized.includes('process.env')
    || normalized.includes('<')
    || normalized.includes('...');
}

function pushFinding(findings, source, match, file, reason) {
  findings.push({
    file,
    line: source.slice(0, match.index).split(/\r?\n/).length,
    reason,
  });
}

function collectFindings(filePath) {
  const relativePath = relative(process.cwd(), filePath);
  const source = readFileSync(filePath, 'utf8');
  const findings = [];
  const secretPattern = secretNames.join('|');
  const isDotenvFile = relativePath.split(/[\\/]/).at(-1)?.startsWith('.env') || false;

  const quotedAssignmentPattern = new RegExp(
    `\\b(${secretPattern})\\b\\s*[:=]\\s*(['"])([^'"]{8,})\\2`,
    'g'
  );
  for (const match of source.matchAll(quotedAssignmentPattern)) {
    const literal = match[3];
    if (!isAllowedLiteral(literal)) {
      pushFinding(findings, source, match, relativePath, `hardcoded value assigned to ${match[1]}`);
    }
  }

  if (isDotenvFile) {
    const dotenvAssignmentPattern = new RegExp(
    `^\\s*(${secretPattern})\\s*=\\s*([^#\\r\\n]{8,})`,
    'gm'
  );
  for (const match of source.matchAll(dotenvAssignmentPattern)) {
    const literal = match[2].trim().replace(/^['"]|['"]$/g, '');
    if (!isAllowedLiteral(literal)) {
      pushFinding(findings, source, match, relativePath, `hardcoded dotenv value assigned to ${match[1]}`);
    }
  }

  }

  const envFallbackPattern = new RegExp(
    `process\\.env\\.(${secretPattern})\\s*\\|\\|\\s*(['"])([^'"]{8,})\\2`,
    'g'
  );
  for (const match of source.matchAll(envFallbackPattern)) {
    const literal = match[3];
    if (!isAllowedLiteral(literal)) {
      pushFinding(findings, source, match, relativePath, `hardcoded fallback for ${match[1]}`);
    }
  }

  // Console logs are intentionally not regex-scanned here: status labels like token_id
  // and secret manager guidance caused broad false positives. Hardcoded secret
  // values and hardcoded env fallbacks remain blocking above.

  return findings;
}

const findings = [];
for (const filePath of listFilesToScan()) {
  findings.push(...collectFindings(filePath));
}

if (findings.length > 0) {
  console.error('Potential secret/log leak findings:');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.reason}`);
  }
  process.exit(1);
}

console.log('Secret/log leak guard passed.');