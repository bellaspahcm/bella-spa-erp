/**
 * BELLA FACTORY — SCHEMA GENERATOR
 * 
 * Converts Product schema specification → deterministic migration SQL
 * 
 * Implementation: Minimal production-quality generator
 * - Applies standard Bella patterns (tenant isolation, RLS, indexes, audit)
 * - Deterministic output (same spec → same SQL)
 * - Validates against Platform constraints
 * 
 * NOT a generic ORM/scaffolding framework.
 */

import type {
  ProductSchemaSpec,
  TableSpec,
  ColumnSpec,
  IndexSpec,
  RLSPolicySpec,
  SchemaGenerationResult,
  ISchemaGenerator,
  STANDARD_AUDIT_FIELDS,
  STANDARD_TENANT_COLUMN,
} from './schema-spec-contract';

// ============================================================================
// SCHEMA GENERATOR IMPLEMENTATION
// ============================================================================

export class BellaSchemaGenerator implements ISchemaGenerator {
  /**
   * Generate migration SQL from Product schema specification
   */
  generate(spec: ProductSchemaSpec): SchemaGenerationResult {
    // Validate first
    const errors = this.validate(spec);
    if (errors.length > 0) {
      throw new Error(`Schema validation failed:\n${errors.join('\n')}`);
    }

    // Generate timestamp for migration filename
    const timestamp = spec.migrationTimestamp || this.generateTimestamp();
    const filename = `${timestamp}_${spec.productId}_schema.sql`;

    // Build SQL sections
    const headerComment = this.generateHeader(spec);
    const tableSQLs = spec.tables.map(table => this.generateTableSQL(table));
    const indexSQLs = spec.tables.flatMap(table => this.generateIndexSQLs(table));
    const rlsSQLs = this.generateRLSSQLs(spec.tables);

    // Combine into complete migration
    const migrationSQL = [
      headerComment,
      '',
      ...tableSQLs,
      '',
      '-- ============================================================================',
      '-- INDEXES',
      '-- ============================================================================',
      '',
      ...indexSQLs,
      '',
      '-- ============================================================================',
      '-- ROW LEVEL SECURITY',
      '-- ============================================================================',
      '',
      ...rlsSQLs,
      '',
    ].join('\n');

    // Count validation metrics
    const tenantTables = spec.tables.filter(t => t.tenantIsolation !== false).length;
    const rlsEnabledTables = spec.tables.filter(t => t.enableRLS !== false).length;
    const totalIndexes = spec.tables.reduce((sum, t) => {
      let count = (t.indexes?.length || 0);
      if (t.tenantIsolation !== false) count++; // Tenant index
      return sum + count;
    }, 0);

    return {
      migrationSQL,
      migrationFilename: filename,
      deterministic: true,
      validation: {
        tenantIsolationApplied: tenantTables === spec.tables.length,
        rlsEnabled: rlsEnabledTables === spec.tables.length,
        indexesCreated: totalIndexes,
        tablesCreated: spec.tables.length,
      },
    };
  }

  /**
   * Validate specification without generating
   */
  validate(spec: ProductSchemaSpec): string[] {
    const errors: string[] = [];

    // Validate product ID
    if (!spec.productId || spec.productId.trim() === '') {
      errors.push('Product ID is required');
    }

    // Validate tables
    if (!spec.tables || spec.tables.length === 0) {
      errors.push('At least one table is required');
    }

    // Validate each table
    spec.tables?.forEach((table, idx) => {
      const tablePrefix = `Table ${idx + 1} (${table.name || 'unnamed'})`;

      // Table name required
      if (!table.name || table.name.trim() === '') {
        errors.push(`${tablePrefix}: Table name is required`);
      }

      // At least one column required
      if (!table.columns || table.columns.length === 0) {
        errors.push(`${tablePrefix}: At least one column is required`);
      }

      // Validate columns
      table.columns?.forEach((col, colIdx) => {
        const colPrefix = `${tablePrefix}, Column ${colIdx + 1}`;

        if (!col.name || col.name.trim() === '') {
          errors.push(`${colPrefix}: Column name is required`);
        }

        if (!col.type) {
          errors.push(`${colPrefix} (${col.name}): Column type is required`);
        }
      });

      // Tenant isolation validation
      if (table.tenantIsolation !== false && table.enableRLS === false) {
        errors.push(`${tablePrefix}: Tenant-isolated tables MUST have RLS enabled`);
      }

      // Check for duplicate column names
      const columnNames = new Set<string>();
      table.columns?.forEach(col => {
        if (columnNames.has(col.name)) {
          errors.push(`${tablePrefix}: Duplicate column name '${col.name}'`);
        }
        columnNames.add(col.name);
      });
    });

    return errors;
  }

  // ============================================================================
  // PRIVATE GENERATION METHODS
  // ============================================================================

  private generateHeader(spec: ProductSchemaSpec): string {
    const lines = [
      '-- ============================================================================',
      `-- ${spec.productId.toUpperCase()} — PRODUCT SCHEMA`,
      '-- ============================================================================',
    ];

    if (spec.comment) {
      lines.push('--');
      lines.push(`-- ${spec.comment}`);
    }

    lines.push('--');
    lines.push('-- Generated by Bella Factory Schema Generator');
    lines.push(`-- Specification Version: ${spec.version}`);
    lines.push('-- Standards: Tenant Isolation + RLS + Audit Fields + Platform Core References');
    lines.push('-- ============================================================================');

    return lines.join('\n');
  }

  private generateTableSQL(table: TableSpec): string {
    const schema = table.schema || 'public';
    const lines: string[] = [];

    // Start table creation
    lines.push('-- ============================================================================');
    lines.push(`-- TABLE: ${table.name}`);
    lines.push('-- ============================================================================');
    lines.push('');
    lines.push(`CREATE TABLE IF NOT EXISTS ${schema}.${table.name} (`);

    // Build all columns
    const allColumns = this.buildColumnList(table);
    const columnDefs = allColumns.map((col, idx) => {
      const isLast = idx === allColumns.length - 1;
      return `  ${this.generateColumnDef(col)}${isLast ? '' : ','}`;
    });

    lines.push(...columnDefs);
    lines.push(');');
    lines.push('');

    return lines.join('\n');
  }

  private buildColumnList(table: TableSpec): ColumnSpec[] {
    const columns: ColumnSpec[] = [];

    // Add standard ID column if no primary key specified
    const hasPrimaryKey = table.columns.some(c => c.primaryKey);
    if (!hasPrimaryKey) {
      columns.push({
        name: 'id',
        type: 'uuid',
        primaryKey: true,
        default: 'gen_random_uuid()',
        nullable: false,
      });
    }

    // Add tenant_id if tenant isolation enabled (default true)
    if (table.tenantIsolation !== false) {
      columns.push({
        name: 'tenant_id',
        type: 'uuid',
        nullable: false,
        references: {
          table: 'tenants',
          column: 'id',
          onDelete: 'CASCADE',
        },
      });
    }

    // Add user-defined columns
    columns.push(...table.columns);

    // Add audit fields if enabled (default true)
    if (table.auditFields !== false) {
      columns.push(
        { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' },
        { name: 'updated_at', type: 'timestamptz', nullable: false, default: 'now()' },
        { name: 'created_by', type: 'uuid', nullable: false },
        { name: 'last_modified_by', type: 'uuid', nullable: false }
      );
    }

    return columns;
  }

  private generateColumnDef(col: ColumnSpec): string {
    const parts: string[] = [col.name];

    // Data type
    parts.push(this.mapColumnType(col.type));

    // Primary key
    if (col.primaryKey) {
      parts.push('PRIMARY KEY');
    }

    // Default value
    if (col.default) {
      parts.push(`DEFAULT ${col.default}`);
    }

    // Nullable
    if (col.nullable === false || col.primaryKey) {
      parts.push('NOT NULL');
    }

    // Unique
    if (col.unique) {
      parts.push('UNIQUE');
    }

    // Check constraint
    if (col.check) {
      parts.push(`CHECK (${col.check})`);
    }

    // Foreign key
    if (col.references) {
      const { table, column, onDelete } = col.references;
      const deleteClause = onDelete ? ` ON DELETE ${onDelete}` : '';
      parts.push(`REFERENCES ${table}(${column})${deleteClause}`);
    }

    return parts.join(' ');
  }

  private mapColumnType(type: string): string {
    // Direct mapping for most types
    const typeMap: Record<string, string> = {
      uuid: 'UUID',
      text: 'TEXT',
      integer: 'INTEGER',
      bigint: 'BIGINT',
      decimal: 'DECIMAL',
      boolean: 'BOOLEAN',
      timestamp: 'TIMESTAMP',
      timestamptz: 'TIMESTAMPTZ',
      date: 'DATE',
      jsonb: 'JSONB',
      'text[]': 'TEXT[]',
      'uuid[]': 'UUID[]',
    };

    return typeMap[type] || type.toUpperCase();
  }

  private generateIndexSQLs(table: TableSpec): string[] {
    const schema = table.schema || 'public';
    const sqls: string[] = [];

    // Tenant index (if tenant isolation enabled)
    if (table.tenantIsolation !== false) {
      const indexName = `idx_${table.name}_tenant_id`;
      sqls.push(
        `CREATE INDEX IF NOT EXISTS ${indexName} ON ${schema}.${table.name}(tenant_id);`
      );
    }

    // User-defined indexes
    if (table.indexes) {
      for (const index of table.indexes) {
        const uniqueClause = index.unique ? 'UNIQUE INDEX' : 'INDEX';
        const columns = index.columns.join(', ');
        sqls.push(
          `CREATE ${uniqueClause} IF NOT EXISTS ${index.name} ON ${schema}.${table.name}(${columns});`
        );
      }
    }

    return sqls;
  }

  private generateRLSSQLs(tables: TableSpec[]): string[] {
    const sqls: string[] = [];

    for (const table of tables) {
      const schema = table.schema || 'public';

      // Enable RLS (if not explicitly disabled)
      if (table.enableRLS !== false) {
        sqls.push(`ALTER TABLE ${schema}.${table.name} ENABLE ROW LEVEL SECURITY;`);
        sqls.push('');
      }

      // Generate policies
      if (table.rlsPolicies && table.rlsPolicies.length > 0) {
        // User-defined policies
        for (const policy of table.rlsPolicies) {
          sqls.push(this.generatePolicySQL(schema, table.name, policy));
          sqls.push('');
        }
      } else if (table.tenantIsolation !== false && table.enableRLS !== false) {
        // Default tenant isolation policy
        const policyName = `tenant_isolation_${table.name}`;
        sqls.push('DO $$');
        sqls.push('BEGIN');
        sqls.push(`  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = '${schema}' AND tablename = '${table.name}' AND policyname = '${policyName}') THEN`);
        sqls.push(`    CREATE POLICY ${policyName} ON ${schema}.${table.name}`);
        sqls.push(`      FOR ALL`);
        sqls.push(`      USING (tenant_id = public.get_auth_tenant_id());`);
        sqls.push('  END IF;');
        sqls.push('END $$;');
        sqls.push('');
      }
    }

    return sqls;
  }

  private generatePolicySQL(schema: string, tableName: string, policy: RLSPolicySpec): string {
    const lines: string[] = ['DO $$', 'BEGIN'];
    lines.push(`  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = '${schema}' AND tablename = '${tableName}' AND policyname = '${policy.name}') THEN`);
    lines.push(`    CREATE POLICY ${policy.name} ON ${schema}.${tableName}`);
    lines.push(`      FOR ${policy.operation}`);
    lines.push(`      USING (${policy.using})`);

    if (policy.withCheck) {
      lines.push(`      WITH CHECK (${policy.withCheck})`);
    }

    lines.push('    ;');
    lines.push('  END IF;');
    lines.push('END $$;');

    return lines.join('\n');
  }

  private generateTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hour}${minute}${second}`;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create schema generator instance
 */
export function createSchemaGenerator(): ISchemaGenerator {
  return new BellaSchemaGenerator();
}
