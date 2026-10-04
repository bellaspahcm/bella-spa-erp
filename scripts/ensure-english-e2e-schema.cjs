const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Client } = require('pg');

const root = join(__dirname, '..');

const MIGRATION_GROUPS = [
  {
    name: 'E3 program/course/class',
    tables: ['english_center_programs', 'english_center_courses', 'english_center_classes'],
    files: ['20260913_create_english_center_program_course_class.sql'],
  },
  {
    name: 'E2 enrollment',
    tables: ['english_center_enrollments'],
    files: ['20260913_create_english_center_enrollments.sql'],
  },
  {
    name: 'E4 teacher',
    tables: ['english_center_teachers', 'english_center_teacher_branches'],
    files: ['20260913_create_english_center_teachers.sql'],
  },
];

const REPAIR_FILES = ['20260914_repair_english_center_branch_rls.sql'];

function splitSql(sql) {
  const statements = [];
  let current = '';
  let dollarTag = null;
  let quote = null;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (!quote && !dollarTag && char === '-' && next === '-') {
      const end = sql.indexOf('\n', i + 2);
      if (end === -1) break;
      i = end;
      continue;
    }

    current += char;

    if (!quote && char === '$') {
      const rest = sql.slice(i);
      const match = rest.match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        const tag = match[0];
        current += tag.slice(1);
        i += tag.length - 1;
        dollarTag = dollarTag === tag ? null : tag;
        continue;
      }
    }

    if (dollarTag) continue;

    if ((char === "'" || char === '"') && sql[i - 1] !== '\\') {
      quote = quote === char ? null : quote || char;
      continue;
    }

    if (!quote && char === ';') {
      const statement = current.trim();
      current = '';
      if (statement && !/^(BEGIN|COMMIT);?$/i.test(statement)) {
        statements.push(statement);
      }
    }
  }

  const trailing = current.trim();
  if (trailing && !/^(BEGIN|COMMIT);?$/i.test(trailing)) {
    statements.push(trailing);
  }

  return statements;
}

async function existingTables(client, tables) {
  const result = await client.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1)
    `,
    [tables],
  );
  return new Set(result.rows.map((row) => row.table_name));
}

async function applySqlFile(client, file) {
  const filePath = join(root, 'supabase', 'migrations', file);
  const statements = splitSql(readFileSync(filePath, 'utf8'));
  console.log(`Applying English E2E schema migration ${file} (${statements.length} statements).`);
  for (const statement of statements) {
    await client.query(statement);
  }
}

async function verifyTables(client, tables) {
  const present = await existingTables(client, tables);
  const missing = tables.filter((table) => !present.has(table));
  if (missing.length > 0) {
    throw new Error(`ENGLISH_E2E_SCHEMA_NOT_READY: missing tables after apply: ${missing.join(', ')}`);
  }
}

async function main() {
  if (process.env.ALLOW_E2E_MIGRATION_APPLY !== '1') {
    throw new Error('Refusing to mutate E2E database without ALLOW_E2E_MIGRATION_APPLY=1.');
  }

  const dbUrl = process.env.SUPABASE_DB_URL || process.env.SUPABASE_DATABASE_URL;
  if (!dbUrl) {
    throw new Error('SUPABASE_DB_URL or SUPABASE_DATABASE_URL is required.');
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  let appliedAny = false;

  try {
    for (const group of MIGRATION_GROUPS) {
      const present = await existingTables(client, group.tables);
      if (present.size === group.tables.length) {
        console.log(`English ${group.name} schema already present.`);
        continue;
      }

      if (present.size > 0) {
        const missing = group.tables.filter((table) => !present.has(table));
        throw new Error(
          `ENGLISH_E2E_SCHEMA_PARTIAL: ${group.name} has partial schema; missing ${missing.join(', ')}`,
        );
      }

      for (const file of group.files) {
        await applySqlFile(client, file);
      }
      appliedAny = true;
      await verifyTables(client, group.tables);
    }

    if (!appliedAny) {
      console.log('English E2/E3/E4 tables already existed; refreshing canonical RLS repair.');
    }

    for (const file of REPAIR_FILES) {
      await applySqlFile(client, file);
    }

    await verifyTables(
      client,
      MIGRATION_GROUPS.flatMap((group) => group.tables),
    );
    console.log('English E2/E3/E4 schema ready for isolated E2E database.');
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  splitSql,
};
