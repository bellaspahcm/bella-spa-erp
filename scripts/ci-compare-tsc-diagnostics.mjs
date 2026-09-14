import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DIAGNOSTIC_PATTERN = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/;

function normalizeDiagnosticLine(line) {
  const match = line.match(DIAGNOSTIC_PATTERN);
  if (!match) return null;

  const [, rawFile, , , code, message] = match;
  const file = rawFile.replace(/\\/g, '/').replace(/^\.\//, '');
  return {
    file,
    code,
    message: message.trim(),
    signature: `${file}|${code}|${message.trim()}`,
  };
}

export function parseDiagnostics(text) {
  const counts = new Map();

  for (const line of text.split(/\r?\n/)) {
    const diagnostic = normalizeDiagnosticLine(line.trim());
    if (!diagnostic) continue;
    counts.set(diagnostic.signature, (counts.get(diagnostic.signature) ?? 0) + 1);
  }

  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

export function compareDiagnostics(baselineDiagnostics, currentDiagnostics) {
  const added = [];
  const reduced = [];
  const unchanged = [];
  const signatures = new Set([
    ...Object.keys(baselineDiagnostics),
    ...Object.keys(currentDiagnostics),
  ]);

  for (const signature of [...signatures].sort()) {
    const baselineCount = baselineDiagnostics[signature] ?? 0;
    const currentCount = currentDiagnostics[signature] ?? 0;
    const delta = currentCount - baselineCount;

    if (delta > 0) {
      added.push({ signature, baselineCount, currentCount, delta });
    } else if (delta < 0) {
      reduced.push({ signature, baselineCount, currentCount, delta });
    } else if (currentCount > 0) {
      unchanged.push({ signature, count: currentCount });
    }
  }

  const baselineTotal = Object.values(baselineDiagnostics).reduce((sum, count) => sum + count, 0);
  const currentTotal = Object.values(currentDiagnostics).reduce((sum, count) => sum + count, 0);

  return {
    status: added.length > 0 ? 'BLOCK' : 'ALLOW',
    baselineTotal,
    currentTotal,
    added,
    reduced,
    unchangedCount: unchanged.length,
  };
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function printComparison(comparison) {
  console.log(`TypeScript diagnostic baseline: ${comparison.baselineTotal}`);
  console.log(`TypeScript diagnostic current: ${comparison.currentTotal}`);

  if (comparison.added.length > 0) {
    console.error('New TypeScript diagnostics detected:');
    for (const item of comparison.added.slice(0, 25)) {
      console.error(`+${item.delta} ${item.signature}`);
    }
    if (comparison.added.length > 25) {
      console.error(`... ${comparison.added.length - 25} more new diagnostic signature(s)`);
    }
  }

  if (comparison.reduced.length > 0) {
    console.log('Reduced TypeScript diagnostics:');
    for (const item of comparison.reduced.slice(0, 25)) {
      console.log(`${item.delta} ${item.signature}`);
    }
    if (comparison.reduced.length > 25) {
      console.log(`... ${comparison.reduced.length - 25} more reduced diagnostic signature(s)`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const baselinePath = process.argv[2];
  const currentPath = process.argv[3];

  if (!baselinePath || !currentPath) {
    console.error('Usage: node scripts/ci-compare-tsc-diagnostics.mjs <baseline-json> <current-output-text>');
    process.exit(2);
  }

  const baselineDiagnostics = loadJson(baselinePath);
  const currentDiagnostics = parseDiagnostics(readFileSync(currentPath, 'utf8'));
  const comparison = compareDiagnostics(baselineDiagnostics, currentDiagnostics);
  printComparison(comparison);
  process.exit(comparison.status === 'BLOCK' ? 1 : 0);
}
