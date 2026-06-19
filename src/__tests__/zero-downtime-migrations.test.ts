const { analyzeSql } = require('../../scripts/check-zero-downtime-migrations.cjs');

describe('zero-downtime migration policy', () => {
  it('accepts additive schema changes and concurrent indexes', () => {
    const sql = [
      'ALTER TABLE customers ADD COLUMN preferred_name text;',
      'CREATE INDEX CONCURRENTLY idx_customers_preferred_name ON customers(preferred_name);',
    ].join('\n');

    expect(analyzeSql(sql)).toEqual([]);
  });

  it.each([
    ['DROP TABLE customers;', 'drop-object'],
    ['ALTER TABLE customers DROP COLUMN phone;', 'drop-column'],
    ['ALTER TABLE customers ALTER COLUMN phone TYPE bigint;', 'alter-column-type'],
    ['ALTER TABLE customers RENAME COLUMN phone TO mobile;', 'rename-table-or-column'],
    ['CREATE INDEX idx_customers_phone ON customers(phone);', 'blocking-index'],
  ])('blocks destructive SQL: %s', (sql, code) => {
    expect(analyzeSql(sql)).toEqual([
      expect.objectContaining({ code, line: 1 }),
    ]);
  });

  it('blocks destructive statements split across lines', () => {
    const sql = [
      'ALTER TABLE customers',
      '  ALTER COLUMN phone',
      '  TYPE bigint;',
    ].join('\n');

    expect(analyzeSql(sql)).toEqual([
      expect.objectContaining({ code: 'alter-column-type' }),
    ]);
  });

  it('requires a scoped exception code and rationale', () => {
    const sql = [
      '-- zero-downtime: allow blocking-index - table is empty before launch',
      'CREATE INDEX idx_new_table_code ON new_table(code);',
    ].join('\n');

    expect(analyzeSql(sql)).toEqual([]);
  });

  it('does not treat commented SQL as executable', () => {
    expect(analyzeSql('-- DROP TABLE customers;')).toEqual([]);
  });
});
