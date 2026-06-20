const {
  analyzeSql,
  maskSqlLiteralsAndComments,
} = require('../../scripts/check-zero-downtime-migrations.cjs');

describe('zero-downtime migration policy', () => {
  it('accepts additive schema changes and concurrent indexes', () => {
    const sql = [
      'ALTER TABLE customers ADD COLUMN preferred_name text;',
      'CREATE INDEX CONCURRENTLY idx_customers_name ON customers(preferred_name);',
    ].join('\n');

    expect(analyzeSql(sql)).toEqual([]);
  });

  it.each([
    ['DROP TABLE customers;', 'drop-object'],
    ['DROP MATERIALIZED VIEW customer_totals;', 'drop-object'],
    ['ALTER TABLE customers DROP COLUMN phone;', 'drop-column'],
    ['TRUNCATE TABLE customers;', 'truncate'],
    ['ALTER TABLE customers ALTER COLUMN phone TYPE bigint;', 'alter-column-type'],
    ['ALTER TABLE customers RENAME COLUMN phone TO mobile;', 'rename-table-or-column'],
    ['ALTER TABLE customers ALTER COLUMN phone SET NOT NULL;', 'set-not-null'],
    ['ALTER TABLE customers VALIDATE CONSTRAINT customers_phone_check;', 'validate-constraint'],
    ['CREATE INDEX idx_customers_phone ON customers(phone);', 'blocking-index'],
  ])('blocks unsafe SQL: %s', (sql, code) => {
    expect(analyzeSql(sql)).toEqual([
      expect.objectContaining({ code, line: 1 }),
    ]);
  });

  it('detects destructive statements inside dollar-quoted procedural bodies', () => {
    const sql = [
      'DO $body$',
      'BEGIN',
      '  DROP TABLE customers;',
      'END',
      '$body$;',
    ].join('\n');

    expect(analyzeSql(sql)).toEqual([
      expect.objectContaining({ code: 'drop-object', line: 3 }),
    ]);
  });

  it('ignores keywords in strings, quoted identifiers, and comments', () => {
    const sql = [
      "-- DROP TABLE customers;",
      "SELECT 'TRUNCATE TABLE customers';",
      'SELECT "DROP TABLE customers";',
      '/* DROP VIEW customer_totals; */',
    ].join('\n');

    expect(analyzeSql(sql)).toEqual([]);
    expect(maskSqlLiteralsAndComments(sql)).toHaveLength(sql.length);
  });

  it('requires a scoped exception code and rationale', () => {
    const sql = [
      '-- zero-downtime: allow blocking-index - table is empty before launch',
      'CREATE INDEX idx_new_table_code ON new_table(code);',
    ].join('\n');

    expect(analyzeSql(sql)).toEqual([]);
  });
});
