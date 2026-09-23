import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { compareDiagnostics, parseDiagnostics, normalizeSignature } from './ci-compare-tsc-diagnostics.mjs';

const mode = process.env.CI_SCOPE_TYPECHECK_MODE || process.argv[2] || 'changed';
const affectedProducts = (process.env.CI_SCOPE_AFFECTED_PRODUCTS || process.env.CI_SCOPE_PRODUCTS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const osScopes = (process.env.CI_SCOPE_OS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const baselinePath = process.env.CI_TSC_DIAGNOSTIC_BASELINES || '.github/ci/tsc-diagnostic-baselines.json';

function run(command, args) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
    },
  });

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runTscProject(project, buildInfoName) {
  runTsc([
    'tsc',
    '-p',
    project,
    '--pretty',
    'false',
    '--incremental',
    '--tsBuildInfoFile',
    `.cache/tsbuildinfo/${buildInfoName}.tsbuildinfo`,
  ], buildInfoName);
}

function runFull() {
  runTsc([
    'tsc',
    '--noEmit',
    '--strict',
    '--pretty',
    'false',
    '--incremental',
    '--tsBuildInfoFile',
    '.cache/tsbuildinfo/full.tsbuildinfo',
  ], 'full');
}

function loadBaselines() {
  try {
    const data = JSON.parse(readFileSync(baselinePath, 'utf8'));
    const fullDiag = data.full?.diagnostics || data['typescript-full']?.diagnostics || data.full;
    if (!fullDiag || Object.keys(fullDiag).length === 0) {
      try {
        const mainData = JSON.parse(readFileSync('.github/ci/baselines/main.json', 'utf8'));
        if (mainData.scopes?.['typescript-full']) {
          const diagnostics = {};
          for (const f of mainData.scopes['typescript-full'].findings || []) {
            const code = f.components?.code || f.code || 'TS0000';
            const sig = normalizeSignature(`${f.file}|${code}|${f.message}`);
            diagnostics[sig] = (diagnostics[sig] || 0) + 1;
          }
          data['full'] = { diagnostics };
          data['typescript-full'] = { diagnostics };
        }
      } catch {
        // ignore
      }
    }
    return data;
  } catch {
    return {};
  }
}

function enforceDiagnosticBaseline(scopeKey, output) {
  const baselines = loadBaselines();
  const baseline = baselines[scopeKey];

  if (!baseline) {
    console.error(`TypeScript failed and no diagnostic baseline exists for scope "${scopeKey}".`);
    console.error(`Add a reviewed baseline to ${baselinePath} or fix the diagnostics.`);
    process.exit(1);
  }

  const currentDiagnostics = parseDiagnostics(output);
  const comparison = compareDiagnostics(baseline.diagnostics ?? baseline, currentDiagnostics);
  console.log(`TypeScript diagnostic baseline (${scopeKey}): ${comparison.baselineTotal}`);
  console.log(`TypeScript diagnostic current (${scopeKey}): ${comparison.currentTotal}`);

  if (comparison.added.length > 0) {
    console.error('New TypeScript diagnostics detected; blocking.');
    for (const item of comparison.added.slice(0, 25)) {
      console.error(`+${item.delta} ${item.signature}`);
    }
    if (comparison.added.length > 25) {
      console.error(`... ${comparison.added.length - 25} more new diagnostic signature(s)`);
    }
    process.exit(1);
  }

  if (comparison.currentTotal < comparison.baselineTotal) {
    console.log('TypeScript diagnostics reduced versus baseline; allowing improvement.');
  } else {
    console.log('TypeScript diagnostics match reviewed baseline; allowing with bounded debt.');
  }
}

function runTsc(args, scopeKey) {
  const outputPath = `.cache/tsbuildinfo/${scopeKey}.diagnostics.txt`;
  mkdirSync(dirname(outputPath), { recursive: true });

  const tscBin = 'node_modules/typescript/bin/tsc';
  const fullArgs = [tscBin, ...args.slice(1)];
  console.log(`\n> node ${fullArgs.join(' ')}`);
  const result = spawnSync(process.execPath, fullArgs, {
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
    },
  });

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');

  writeFileSync(outputPath, output);

  if ((result.status ?? 1) === 0) {
    console.log(`TypeScript scope "${scopeKey}" passed with zero diagnostics.`);
    return;
  }

  enforceDiagnosticBaseline(scopeKey, output);
}

function runChanged() {
  if (affectedProducts.includes('mobile')) {
    run('npm', ['run', 'mobile:typecheck']);
  }

  if (affectedProducts.includes('education_preschool')) {
    runTscProject('tsconfig.education.json', 'education');
    return;
  }

  if (affectedProducts.includes('english_center')) {
    runTscProject('tsconfig.english-center.json', 'english-center');
    return;
  }

  if (osScopes.includes('beauty')) {
    runTscProject('tsconfig.beauty.json', 'beauty');
    return;
  }

  runFull();
}

function runAffected() {
  if (osScopes.includes('beauty')) {
    runTscProject('tsconfig.beauty.json', 'beauty-affected');
    return;
  }

  if (osScopes.includes('education') || affectedProducts.includes('education_preschool') || affectedProducts.includes('english_center')) {
    runTscProject('tsconfig.education.json', 'education-affected');
    if (affectedProducts.includes('english_center')) {
      runTscProject('tsconfig.english-center.json', 'english-center-affected');
    }
    return;
  }

  runFull();
}

if (mode === 'skip') {
  console.log('Typecheck skipped by dependency-aware CI routing.');
} else if (mode === 'changed') {
  runChanged();
} else if (mode === 'affected') {
  runAffected();
} else if (mode === 'full') {
  runFull();
} else {
  console.error(`Unknown CI typecheck mode: ${mode}`);
  process.exit(1);
}
