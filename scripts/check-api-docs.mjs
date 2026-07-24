import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const apiRoot = join(process.cwd(), 'src', 'app', 'api');
const docsPath = join(process.cwd(), 'docs', 'api-reference.md');
const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const methodExportPatterns = {
  GET: /export\s+async\s+function\s+GET\b/,
  POST: /export\s+async\s+function\s+POST\b/,
  PUT: /export\s+async\s+function\s+PUT\b/,
  PATCH: /export\s+async\s+function\s+PATCH\b/,
  DELETE: /export\s+async\s+function\s+DELETE\b/,
  HEAD: /export\s+async\s+function\s+HEAD\b/,
  OPTIONS: /export\s+async\s+function\s+OPTIONS\b/,
};

function walk(dir) {
  const entries = readdirSync(dir);
  const files = [];

  for (const entry of entries) {
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

function exportedMethods(source) {
  return httpMethods.filter((method) => {
    return methodExportPatterns[method].test(source);
  });
}

const docs = readFileSync(docsPath, 'utf8');
const missing = [];

const allowedRoutePatterns = [
  /^\/api\/v\d+(?:\/|$)/,
  /^\/api\/webhooks(?:\/|$)/,
  /^\/api\/cron(?:\/|$)/,
  /^\/api\/test-upcoming$/,
];

for (const filePath of walk(apiRoot)) {
  const source = readFileSync(filePath, 'utf8');
  const path = routePath(filePath);

  const isAllowed = allowedRoutePatterns.some((pattern) => pattern.test(path));
  if (!isAllowed) {
    // Skip checking internal/private routes
    continue;
  }

  for (const method of exportedMethods(source)) {
    const needle = `${method} ${path}`;
    if (!docs.includes(needle)) {
      missing.push(`${needle} (${relative(process.cwd(), filePath)})`);
    }
  }
}

if (missing.length > 0) {
  console.error('API documentation is missing these implemented routes:');
  for (const item of missing) {
    console.error('- %s', item);
  }
  process.exit(1);
}

console.log('API documentation covers all implemented route handlers.');
