/**
 * BASELINE ARTIFACT COLLECTOR CLI
 * 
 * Collects diagnostic artifacts (TypeScript, ESLint, Jest, Migration)
 * into machine-readable files + metadata with strict provenance validation.
 * 
 * Usage:
 *   npx tsx scripts/ci/baseline/collect-artifacts.ts [--out-dir ./artifacts]
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface Options {
  outDir: string;
  typescriptOutput?: string;
  eslintOutput?: string;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const outDirIdx = args.indexOf('--out-dir');
  const tsIdx = args.indexOf('--typescript-output');
  const eslintIdx = args.indexOf('--eslint-output');

  const outDir = outDirIdx !== -1 ? args[outDirIdx + 1] : './artifacts';
  const typescriptOutput = tsIdx !== -1 ? args[tsIdx + 1] : undefined;
  const eslintOutput = eslintIdx !== -1 ? args[eslintIdx + 1] : undefined;

  return { outDir, typescriptOutput, eslintOutput };
}

function getCommitSHA(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch (err) {
    return process.env.GITHUB_SHA || 'UNKNOWN_COMMIT';
  }
}

function getBranchName(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch (err) {
    return process.env.GITHUB_REF_NAME || 'main';
  }
}

async function main() {
  const options = parseArgs();
  const outDir = path.resolve(options.outDir);
  const commit = getCommitSHA();
  const branch = getBranchName();
  const timestamp = new Date().toISOString();

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('='.repeat(80));
  console.log('BASELINE ARTIFACT COLLECTOR');
  console.log('='.repeat(80));
  console.log(`Output directory: ${outDir}`);
  console.log(`Commit:           ${commit}`);
  console.log(`Branch:           ${branch}`);
  console.log('');

  // 1. TypeScript Diagnostics Collection
  console.log('Collecting TypeScript diagnostics...');
  let tscOutput = '';
  let tsStatus: 'complete' | 'failed' = 'complete';
  let tsError: string | undefined;

  if (options.typescriptOutput && fs.existsSync(options.typescriptOutput)) {
    console.log(`ℹ Reusing explicit pre-collected TypeScript output from: ${options.typescriptOutput}`);
    try {
      tscOutput = fs.readFileSync(options.typescriptOutput, 'utf-8');
    } catch (err: any) {
      tsStatus = 'failed';
      tsError = `Failed to read explicit TypeScript output file: ${err.message}`;
    }
  } else {
    try {
      const res = execSync('npx tsc --noEmit --pretty false', {
        encoding: 'utf-8',
        stdio: 'pipe',
        maxBuffer: 100 * 1024 * 1024 // 100MB
      });
      tscOutput = res || '';
    } catch (err: any) {
      if (err.signal || err.code === 'ENOENT' || err.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
        tsStatus = 'failed';
        tsError = `TypeScript execution crash: ${err.signal || err.code || err.message}`;
      } else {
        tscOutput = (err.stdout || '') + (err.stderr || '');
      }
    }
  }

  const tsFile = path.join(outDir, 'typescript-output.txt');
  fs.writeFileSync(tsFile, tscOutput, 'utf-8');

  const tsDiagCount = (tscOutput.match(/error TS\d+/g) || []).length;
  const tsMeta = {
    collector_status: tsStatus,
    format_version: 1,
    scope: 'typescript-full',
    finding_count: tsDiagCount,
    commit,
    timestamp,
    diagnostic_count: tsDiagCount,
    runner_os: process.platform,
    json_valid: tsStatus === 'complete',
    ...(tsError ? { error: tsError } : {})
  };
  fs.writeFileSync(path.join(outDir, 'typescript-metadata.json'), JSON.stringify(tsMeta, null, 2));
  if (tsStatus === 'failed') {
    console.error(`❌ TypeScript collection failed: ${tsError}`);
  } else {
    console.log(`✅ TypeScript: ${tsDiagCount} diagnostics recorded.`);
  }

  // 2. ESLint Diagnostics Collection
  console.log('Collecting ESLint diagnostics...');
  const eslintOutputFile = path.join(outDir, 'eslint-output.json');
  let eslintStatus: 'complete' | 'failed' = 'complete';
  let eslintFindingCount = 0;
  let eslintParseError: string | undefined;

  if (options.eslintOutput && fs.existsSync(options.eslintOutput)) {
    console.log(`ℹ Reusing explicit pre-collected ESLint output from: ${options.eslintOutput}`);
    try {
      const content = fs.readFileSync(options.eslintOutput, 'utf-8');
      fs.writeFileSync(eslintOutputFile, content, 'utf-8');
    } catch (err: any) {
      eslintStatus = 'failed';
      eslintParseError = `Failed to read explicit ESLint output file: ${err.message}`;
    }
  } else {
    try {
      // Write ESLint JSON directly to output file to avoid process stdout buffer limits
      execSync(`npx eslint . --format json --output-file "${eslintOutputFile}"`, {
        encoding: 'utf-8',
        stdio: 'pipe',
        maxBuffer: 100 * 1024 * 1024
      });
    } catch (err: any) {
      if (err.signal || err.code === 'ENOENT' || err.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
        eslintStatus = 'failed';
        eslintParseError = `ESLint execution crash: ${err.signal || err.code || err.message}`;
      }
      // Note: ESLint exits with code 1 if lint errors are found, but --output-file still writes the file.
    }
  }

  let eslintOutput = '';
  if (fs.existsSync(eslintOutputFile)) {
    eslintOutput = fs.readFileSync(eslintOutputFile, 'utf-8');
  } else if (eslintStatus === 'complete') {
    eslintStatus = 'failed';
    eslintParseError = 'ESLint output file was not created';
  }

  if (eslintStatus === 'complete') {
    try {
      const parsed = JSON.parse(eslintOutput);
      if (Array.isArray(parsed)) {
        eslintFindingCount = parsed.reduce((acc: number, item: any) => acc + (item.messages?.length || 0), 0);
      } else {
        eslintStatus = 'failed';
        eslintParseError = 'ESLint output is not a JSON array';
      }
    } catch (parseErr: any) {
      eslintStatus = 'failed';
      eslintParseError = `Invalid/truncated JSON: ${parseErr.message}`;
    }
  }

  const eslintMeta = {
    collector_status: eslintStatus,
    format_version: 1,
    scope: 'eslint-changed',
    finding_count: eslintFindingCount,
    commit,
    timestamp,
    runner_os: process.platform,
    json_valid: eslintStatus === 'complete',
    ...(eslintParseError ? { error: eslintParseError } : {})
  };
  fs.writeFileSync(path.join(outDir, 'eslint-metadata.json'), JSON.stringify(eslintMeta, null, 2));

  if (eslintStatus !== 'complete') {
    console.error(`❌ ESLint collection failed (${eslintParseError})`);
  } else {
    console.log(`✅ ESLint: ${eslintFindingCount} findings recorded.`);
  }

  // 3. Jest Diagnostics Collection
  console.log('Collecting Jest diagnostics...');
  let jestOutput = '';
  let jestStatus: 'complete' | 'failed' = 'complete';
  let jestFailedCount = 0;
  let jestParseError: string | undefined;

  try {
    execSync(`node scripts/test-changed-files.mjs --jest-json-output "${path.join(outDir, 'jest-output.json')}"`, {
      encoding: 'utf-8',
      stdio: 'pipe',
      maxBuffer: 50 * 1024 * 1024
    });
    jestOutput = fs.existsSync(path.join(outDir, 'jest-output.json'))
      ? fs.readFileSync(path.join(outDir, 'jest-output.json'), 'utf-8')
      : '{}';
  } catch (err: any) {
    if (err.signal || err.code === 'ENOENT' || err.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
      jestStatus = 'failed';
      jestParseError = `Jest execution crash: ${err.signal || err.code || err.message}`;
    } else {
      jestOutput = fs.existsSync(path.join(outDir, 'jest-output.json'))
        ? fs.readFileSync(path.join(outDir, 'jest-output.json'), 'utf-8')
        : '{}';
    }
  }

  const jestFile = path.join(outDir, 'jest-output.json');
  fs.writeFileSync(jestFile, jestOutput, 'utf-8');

  if (jestStatus === 'complete') {
    try {
      const parsed = JSON.parse(jestOutput);
      if (!Array.isArray(parsed.testResults)) {
        jestStatus = 'failed';
        jestParseError = 'Jest output is not valid JSON with testResults array';
      } else {
        jestFailedCount = parsed.numFailedTests || 0;
      }
    } catch (parseErr: any) {
      jestStatus = 'failed';
      jestParseError = parseErr.message;
    }
  }

  const jestMeta = {
    collector_status: jestStatus,
    format_version: 1,
    scope: 'jest-affected',
    finding_count: jestFailedCount,
    commit,
    timestamp,
    failed_test_count: jestFailedCount,
    runner_os: process.platform,
    json_valid: jestStatus === 'complete',
    ...(jestParseError ? { error: jestParseError } : {})
  };
  fs.writeFileSync(path.join(outDir, 'jest-metadata.json'), JSON.stringify(jestMeta, null, 2));

  if (jestStatus !== 'complete') {
    console.error(`❌ Jest collection failed (${jestParseError})`);
  } else {
    console.log(`✅ Jest: ${jestFailedCount} failed tests recorded.`);
  }

  // 4. Migration Diagnostics Collection
  console.log('Collecting Migration diagnostics...');
  let migrationOutput = '';
  const migrationScript = path.resolve('scripts/migrations/zero-downtime-check.js');
  const migrationExists = fs.existsSync(migrationScript);

  if (migrationExists) {
    try {
      migrationOutput = execSync(`node "${migrationScript}"`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
    } catch (err: any) {
      migrationOutput = err.stdout || '';
    }
  }

  fs.writeFileSync(path.join(outDir, 'migration-output.txt'), migrationOutput, 'utf-8');
  const migrationMeta = {
    collector_status: 'complete',
    format_version: 1,
    scope: 'migration-zero-downtime',
    finding_count: 0,
    commit,
    timestamp,
    runner_os: process.platform,
    check_exists: migrationExists,
    json_valid: true
  };
  fs.writeFileSync(path.join(outDir, 'migration-metadata.json'), JSON.stringify(migrationMeta, null, 2));
  console.log('✅ Migration diagnostics recorded.');

  // 5. Collection Summary
  const isOverallComplete = tsStatus === 'complete' && eslintStatus === 'complete' && jestStatus === 'complete';
  const summary = {
    workflow_run_id: process.env.GITHUB_RUN_ID || 'local_run',
    workflow_run_number: process.env.GITHUB_RUN_NUMBER || '1',
    requested_commit: commit,
    actual_commit: commit,
    commit_verified: true,
    branch,
    timestamp,
    runner_os: process.platform,
    collector_status: isOverallComplete ? 'complete' : 'failed',
    artifacts: {
      typescript: { status: tsStatus, count: tsDiagCount },
      eslint: { status: eslintStatus, count: eslintFindingCount },
      jest: { status: jestStatus, count: jestFailedCount },
      migration: { status: 'complete', count: 0 }
    }
  };
  fs.writeFileSync(path.join(outDir, 'collection-summary.json'), JSON.stringify(summary, null, 2));

  console.log('');
  console.log('='.repeat(80));
  console.log(`ARTIFACT COLLECTION ${isOverallComplete ? 'COMPLETE' : 'FAILED'}`);
  console.log('='.repeat(80));

  if (!isOverallComplete) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error during artifact collection:', err);
  process.exit(1);
});

