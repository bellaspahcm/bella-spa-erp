import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const roots = ['src', 'scripts', '.github/workflows'];
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.yml', '.yaml']);
const excludedPathFragments = [
  `${sep}__tests__${sep}`,
  `${sep}node_modules${sep}`,
  `${sep}.next${sep}`,
  `${sep}test-results${sep}`,
];
const excludedFiles = new Set([
  'scripts/check-secret-leaks.mjs',
]);

const secretNames = [
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

const consoleSensitiveTerms = [
  'access_token',
  'authorization',
  'botToken',
  'client_secret',
  'password',
  'refresh_token',
  'secret',
  'service_role',
  'serviceRole',
  'telegram_bot_token',
  'token',
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

function isAllowedLiteral(value) {
  return /^(test|mock|dummy|example|placeholder|redacted|changeme|your-)/i.test(value)
    || value.includes('${{')
    || value.includes('process.env');
}

function collectFindings(filePath) {
  const relativePath = relative(process.cwd(), filePath);
  const source = readFileSync(filePath, 'utf8');
  const findings = [];
  const lines = source.split(/\r?\n/);

  const assignmentPattern = new RegExp(
    `\\b(${secretNames.join('|')})\\b\\s*[:=]\\s*(['"])([^'"]{8,})\\2`,
    'g'
  );
  for (const match of source.matchAll(assignmentPattern)) {
    const literal = match[3];
    if (!isAllowedLiteral(literal)) {
      findings.push({
        file: relativePath,
        line: source.slice(0, match.index).split(/\r?\n/).length,
        reason: `hardcoded value assigned to ${match[1]}`,
      });
    }
  }

  const envFallbackPattern = new RegExp(
    `process\\.env\\.(${secretNames.join('|')})\\s*\\|\\|\\s*(['"])([^'"]{8,})\\2`,
    'g'
  );
  for (const match of source.matchAll(envFallbackPattern)) {
    const literal = match[3];
    if (!isAllowedLiteral(literal)) {
      findings.push({
        file: relativePath,
        line: source.slice(0, match.index).split(/\r?\n/).length,
        reason: `hardcoded fallback for ${match[1]}`,
      });
    }
  }

  lines.forEach((line, index) => {
    if (!/console\.(log|warn|error|info|debug)\s*\(/.test(line)) return;
    if (consoleSensitiveTerms.some((term) => line.includes(term))) {
      findings.push({
        file: relativePath,
        line: index + 1,
        reason: 'console statement references a sensitive token/secret identifier',
      });
    }
  });

  return findings;
}

const findings = [];
for (const root of roots) {
  const absoluteRoot = join(process.cwd(), root);
  for (const filePath of walk(absoluteRoot)) {
    findings.push(...collectFindings(filePath));
  }
}

if (findings.length > 0) {
  console.error('Potential secret/log leak findings:');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.reason}`);
  }
  process.exit(1);
}

console.log('Secret/log leak guard passed.');
