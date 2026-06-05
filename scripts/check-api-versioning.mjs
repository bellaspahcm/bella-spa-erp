import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const apiRoot = join(process.cwd(), 'src', 'app', 'api');
const policyPath = join(process.cwd(), 'docs', 'api-versioning-policy.md');

const allowedRoutePatterns = [
  /^\/api\/v\d+(?:\/|$)/,
  /^\/api\/webhooks(?:\/|$)/,
  /^\/api\/cron(?:\/|$)/,
  /^\/api\/test-upcoming$/,
];

function walk(dir) {
  const files = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry === 'route.ts') {
      files.push(fullPath);
    }
  }

  return files;
}

function routePath(filePath) {
  const relativePath = relative(apiRoot, filePath);
  const segments = relativePath.split(sep).slice(0, -1);
  return `/api/${segments.map((segment) => segment.replace(/^\[(.+)\]$/, '{$1}')).join('/')}`;
}

const policy = readFileSync(policyPath, 'utf8');
const violations = [];

for (const filePath of walk(apiRoot)) {
  const path = routePath(filePath);
  const isAllowed = allowedRoutePatterns.some((pattern) => pattern.test(path));
  if (!isAllowed) {
    violations.push(`${path} (${relative(process.cwd(), filePath)})`);
  }
}

const requiredPolicyPhrases = [
  '/api/v1',
  '/api/webhooks',
  '/api/cron',
  '/api/test-upcoming',
  'Breaking Change',
];

for (const phrase of requiredPolicyPhrases) {
  if (!policy.includes(phrase)) {
    violations.push(`docs/api-versioning-policy.md missing required phrase: ${phrase}`);
  }
}

if (violations.length > 0) {
  console.error('API versioning policy violations:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('API versioning policy covers all implemented route groups.');
