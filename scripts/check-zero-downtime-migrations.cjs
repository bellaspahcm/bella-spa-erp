const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const MIGRATION_PATH = /^supabase[\\/]migrations[\\/].+\.sql$/i;
const RULES = [
  { code: 'drop-object', matches: (sql) => /\bDROP\s+(?:TABLE|SCHEMA|TYPE)\b/i.test(sql) },
  { code: 'drop-column', matches: (sql) => /\bDROP\s+COLUMN\b/i.test(sql) },
  { code: 'alter-column-type', matches: (sql) => /\bALTER\s+COLUMN\b[\s\S]*?\bTYPE\b/i.test(sql) },
  { code: 'rename-table-or-column', matches: (sql) => /\bALTER\s+TABLE\b[\s\S]*?\bRENAME\s+(?:COLUMN|TO)\b/i.test(sql) },
  {
    code: 'blocking-index',
    matches: (sql) => /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(sql)
      && !/\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/i.test(sql),
  },
];

function hasAllowAnnotation(statement, code) {
  return new RegExp('--\\s*zero-downtime:\\s*allow\\s+' + code + '\\s+-\\s+\\S', 'i')
    .test(statement);
}

function analyzeSql(sql) {
  const source = String(sql);
  const findings = [];
  const statementPattern = /(?:^|;)([\s\S]*?)(?=;|$)/g;
  let match;

  while ((match = statementPattern.exec(source)) !== null) {
    const rawStatement = match[1];
    const executable = rawStatement.replace(/--.*$/gm, '').trim();
    if (!executable) continue;

    const statementOffset = match.index + (match[0].startsWith(';') ? 1 : 0);
    const line = source.slice(0, statementOffset).split(/\r?\n/).length;

    for (const rule of RULES) {
      if (rule.matches(executable) && !hasAllowAnnotation(rawStatement, rule.code)) {
        findings.push({
          code: rule.code,
          line,
          statement: executable.replace(/\s+/g, ' '),
        });
      }
    }
  }

  return findings;
}

function gitLines(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    throw new Error('Could not determine changed migrations: ' + error.message);
  }
}

function listChangedMigrations(baseRef = process.env.ZERO_DOWNTIME_BASE_REF || 'HEAD^') {
  const candidates = new Set([
    ...gitLines(['diff', '--name-only', '--diff-filter=ACMR', baseRef, '--', 'supabase/migrations']),
    ...gitLines(['diff', '--name-only', '--diff-filter=ACMR', '--cached', '--', 'supabase/migrations']),
    ...gitLines(['diff', '--name-only', '--diff-filter=ACMR', '--', 'supabase/migrations']),
    ...gitLines(['ls-files', '--others', '--exclude-standard', '--', 'supabase/migrations']),
  ]);

  return [...candidates].filter((file) => MIGRATION_PATH.test(file)).sort();
}

function main() {
  const baseArgIndex = process.argv.indexOf('--base');
  const baseRef = baseArgIndex >= 0 ? process.argv[baseArgIndex + 1] : undefined;
  if (baseArgIndex >= 0 && !baseRef) {
    throw new Error('The --base option requires a git ref.');
  }

  const files = listChangedMigrations(baseRef);
  if (files.length === 0) {
    console.log('No changed Supabase migrations require zero-downtime review.');
    return;
  }

  let failed = false;
  for (const file of files) {
    const findings = analyzeSql(readFileSync(resolve(file), 'utf8'));
    for (const finding of findings) {
      failed = true;
      console.error(file + ':' + finding.line + ' [' + finding.code + '] ' + finding.statement);
    }
  }

  if (failed) {
    console.error('Zero-downtime migration check failed. Use an expand/contract migration.');
    console.error('A reviewed exception must use: -- zero-downtime: allow <rule-code> - <reason>');
    process.exitCode = 1;
    return;
  }

  console.log('Zero-downtime migration check passed for ' + files.length + ' migration(s).');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = { analyzeSql, listChangedMigrations };
