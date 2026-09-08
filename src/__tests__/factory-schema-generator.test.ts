/**
 * BELLA FACTORY — SCHEMA GENERATOR TESTS
 * 
 * Validates:
 * - Deterministic output (same input → same SQL)
 * - Standard patterns applied (tenant isolation, RLS, audit fields)
 * - Validation rules enforced
 * - Generated SQL matches Platform conventions
 */

import { describe, it, expect } from '@jest/globals';
import { createSchemaGenerator } from '../../.factory/schema-generator';
import type { ProductSchemaSpec } from '../../.factory/schema-spec-contract';

describe('BellaSchemaGenerator', () => {
  const generator = createSchemaGenerator();

  describe('Validation', () => {
    it('rejects empty product ID', () => {
      const spec: ProductSchemaSpec = {
        productId: '',
        version: '1.0',
        tables: [],
      };

      const errors = generator.validate(spec);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('Product ID'))).toBe(true);
    });

    it('rejects spec with no tables', () => {
      const spec: ProductSchemaSpec = {
        productId: 'test-product',
        version: '1.0',
        tables: [],
      };

      const errors = generator.validate(spec);
      expect(errors.some(e => e.includes('At least one table'))).toBe(true);
    });

    it('rejects table with no columns', () => {
      const spec: ProductSchemaSpec = {
        productId: 'test-product',
        version: '1.0',
        tables: [
          {
            name: 'test_table',
            columns: [],
          },
        ],
      };

      const errors = generator.validate(spec);
      expect(errors.some(e => e.includes('At least one column'))).toBe(true);
    });

    it('rejects tenant-isolated table without RLS', () => {
      const spec: ProductSchemaSpec = {
        productId: 'test-product',
        version: '1.0',
        tables: [
          {
            name: 'test_table',
            tenantIsolation: true,
            enableRLS: false, // Violation
            columns: [{ name: 'test_col', type: 'text' }],
          },
        ],
      };

      const errors = generator.validate(spec);
      expect(errors.some(e => e.includes('RLS enabled'))).toBe(true);
    });

    it('accepts valid minimal spec', () => {
      const spec: ProductSchemaSpec = {
        productId: 'test-product',
        version: '1.0',
        tables: [
          {
            name: 'test_table',
            columns: [{ name: 'test_col', type: 'text' }],
          },
        ],
      };

      const errors = generator.validate(spec);
      expect(errors).toEqual([]);
    });
  });

  describe('Standard Patterns', () => {
    it('adds id column if no primary key specified', () => {
      const spec: ProductSchemaSpec = {
        productId: 'test-product',
        version: '1.0',
        tables: [
          {
            name: 'test_table',
            columns: [{ name: 'name', type: 'text' }],
          },
        ],
      };

      const result = generator.generate(spec);
      expect(result.migrationSQL).toContain('id UUID PRIMARY KEY DEFAULT gen_random_uuid()');
    });

    it('adds tenant_id with FK by default', () => {
      const spec: ProductSchemaSpec = {
        productId: 'test-product',
        version: '1.0',
        tables: [
          {
            name: 'test_table',
            columns: [{ name: 'name', type: 'text' }],
          },
        ],
      };

      const result = generator.generate(spec);
      expect(result.migrationSQL).toContain('tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE');
    });

    it('adds audit fields by default', () => {
      const spec: ProductSchemaSpec = {
        productId: 'test-product',
        version: '1.0',
        tables: [
          {
            name: 'test_table',
            columns: [{ name: 'name', type: 'text' }],
          },
        ],
      };

      const result = generator.generate(spec);
      expect(result.migrationSQL).toContain('created_at TIMESTAMPTZ');
      expect(result.migrationSQL).toContain('DEFAULT now()');
      expect(result.migrationSQL).toContain('updated_at TIMESTAMPTZ');
      expect(result.migrationSQL).toContain('created_by UUID NOT NULL');
      expect(result.migrationSQL).toContain('last_modified_by UUID NOT NULL');
    });

    it('omits tenant_id when tenantIsolation=false', () => {
      const spec: ProductSchemaSpec = {
        productId: 'test-product',
        version: '1.0',
        tables: [
          {
            name: 'test_table',
            tenantIsolation: false,
            enableRLS: false,
            columns: [{ name: 'name', type: 'text' }],
          },
        ],
      };

      const result = generator.generate(spec);
      expect(result.migrationSQL).not.toContain('tenant_id');
    });

    it('omits audit fields when auditFields=false', () => {
      const spec: ProductSchemaSpec = {
        productId: 'test-product',
        version: '1.0',
        tables: [
          {
            name: 'test_table',
            auditFields: false,
            columns: [{ name: 'name', type: 'text' }],
          },
        ],
      };

      const result = generator.generate(spec);
      expect(result.migrationSQL).not.toContain('created_at');
      expect(result.migrationSQL).not.toContain('updated_at');
    });
  });

  describe('RLS Generation', () => {
    it('enables RLS by default', () => {
      const spec: ProductSchemaSpec = {
        productId: 'test-product',
        version: '1.0',
        tables: [
          {
            name: 'test_table',
            columns: [{ name: 'name', type: 'text' }],
          },
        ],
      };

      const result = generator.generate(spec);
      expect(result.migrationSQL).toContain('ALTER TABLE public.test_table ENABLE ROW LEVEL SECURITY');
    });

    it('creates default tenant isolation policy', () => {
      const spec: ProductSchemaSpec = {
        productId: 'test-product',
        version: '1.0',
        tables: [
          {
            name: 'test_table',
            columns: [{ name: 'name', type: 'text' }],
          },
        ],
      };

      const result = generator.generate(spec);
      expect(result.migrationSQL).toContain('tenant_isolation_test_table');
      expect(result.migrationSQL).toContain('tenant_id = public.get_auth_tenant_id()');
    });

    it('uses custom RLS policies when provided', () => {
      const spec: ProductSchemaSpec = {
        productId: 'test-product',
        version: '1.0',
        tables: [
          {
            name: 'test_table',
            columns: [{ name: 'name', type: 'text' }],
            rlsPolicies: [
              {
                name: 'custom_policy',
                operation: 'SELECT',
                using: 'true', // Example custom policy
              },
            ],
          },
        ],
      };

      const result = generator.generate(spec);
      expect(result.migrationSQL).toContain('custom_policy');
      expect(result.migrationSQL).toContain('FOR SELECT');
    });
  });

  describe('Index Generation', () => {
    it('creates tenant_id index by default', () => {
      const spec: ProductSchemaSpec = {
        productId: 'test-product',
        version: '1.0',
        tables: [
          {
            name: 'test_table',
            columns: [{ name: 'name', type: 'text' }],
          },
        ],
      };

      const result = generator.generate(spec);
      expect(result.migrationSQL).toContain('CREATE INDEX IF NOT EXISTS idx_test_table_tenant_id');
    });

    it('creates user-defined indexes', () => {
      const spec: ProductSchemaSpec = {
        productId: 'test-product',
        version: '1.0',
        tables: [
          {
            name: 'test_table',
            columns: [
              { name: 'email', type: 'text' },
              { name: 'status', type: 'text' },
            ],
            indexes: [
              {
                name: 'idx_test_table_email',
                columns: ['email'],
                unique: true,
              },
              {
                name: 'idx_test_table_status',
                columns: ['status'],
              },
            ],
          },
        ],
      };

      const result = generator.generate(spec);
      expect(result.migrationSQL).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_test_table_email');
      expect(result.migrationSQL).toContain('CREATE INDEX IF NOT EXISTS idx_test_table_status');
    });
  });

  describe('Column Types and Constraints', () => {
    it('generates CHECK constraints', () => {
      const spec: ProductSchemaSpec = {
        productId: 'test-product',
        version: '1.0',
        tables: [
          {
            name: 'test_table',
            columns: [
              {
                name: 'status',
                type: 'text',
                check: "status IN ('active', 'inactive')",
              },
            ],
          },
        ],
      };

      const result = generator.generate(spec);
      expect(result.migrationSQL).toContain("CHECK (status IN ('active', 'inactive'))");
    });

    it('generates foreign key references', () => {
      const spec: ProductSchemaSpec = {
        productId: 'test-product',
        version: '1.0',
        tables: [
          {
            name: 'orders',
            columns: [
              {
                name: 'customer_id',
                type: 'uuid',
                nullable: false,
                references: {
                  table: 'customers',
                  column: 'id',
                  onDelete: 'CASCADE',
                },
              },
            ],
          },
        ],
      };

      const result = generator.generate(spec);
      expect(result.migrationSQL).toContain('REFERENCES customers(id) ON DELETE CASCADE');
    });

    it('supports all standard column types', () => {
      const spec: ProductSchemaSpec = {
        productId: 'test-product',
        version: '1.0',
        tables: [
          {
            name: 'test_table',
            columns: [
              { name: 'col_uuid', type: 'uuid' },
              { name: 'col_text', type: 'text' },
              { name: 'col_integer', type: 'integer' },
              { name: 'col_boolean', type: 'boolean' },
              { name: 'col_timestamp', type: 'timestamptz' },
              { name: 'col_jsonb', type: 'jsonb' },
            ],
          },
        ],
      };

      const result = generator.generate(spec);
      expect(result.migrationSQL).toContain('col_uuid UUID');
      expect(result.migrationSQL).toContain('col_text TEXT');
      expect(result.migrationSQL).toContain('col_integer INTEGER');
      expect(result.migrationSQL).toContain('col_boolean BOOLEAN');
      expect(result.migrationSQL).toContain('col_timestamp TIMESTAMPTZ');
      expect(result.migrationSQL).toContain('col_jsonb JSONB');
    });
  });

  describe('Deterministic Output', () => {
    it('produces identical SQL for same input (deterministic)', () => {
      const spec: ProductSchemaSpec = {
        productId: 'test-product',
        version: '1.0',
        migrationTimestamp: '20260905120000', // Fixed timestamp
        tables: [
          {
            name: 'orders',
            columns: [
              { name: 'order_number', type: 'text', nullable: false },
              { name: 'status', type: 'text', check: "status IN ('pending', 'completed')" },
              { name: 'total_amount', type: 'decimal' },
            ],
            indexes: [
              { name: 'idx_orders_status', columns: ['status'] },
            ],
          },
        ],
      };

      const result1 = generator.generate(spec);
      const result2 = generator.generate(spec);

      expect(result1.migrationSQL).toBe(result2.migrationSQL);
      expect(result1.deterministic).toBe(true);
      expect(result2.deterministic).toBe(true);
    });
  });

  describe('Validation Metrics', () => {
    it('reports correct validation metrics', () => {
      const spec: ProductSchemaSpec = {
        productId: 'test-product',
        version: '1.0',
        tables: [
          {
            name: 'table1',
            columns: [{ name: 'col1', type: 'text' }],
            indexes: [
              { name: 'idx1', columns: ['col1'] },
              { name: 'idx2', columns: ['col1'] },
            ],
          },
          {
            name: 'table2',
            columns: [{ name: 'col2', type: 'text' }],
          },
        ],
      };

      const result = generator.generate(spec);

      expect(result.validation.tablesCreated).toBe(2);
      expect(result.validation.tenantIsolationApplied).toBe(true);
      expect(result.validation.rlsEnabled).toBe(true);
      // 2 tables × (1 tenant index + user indexes) = 2 tenant + 2 user = 4
      expect(result.validation.indexesCreated).toBe(4);
    });
  });

  describe('Complex Schema Example', () => {
    it('generates complete Product schema with multiple tables', () => {
      const spec: ProductSchemaSpec = {
        productId: 'logistics-os',
        version: '1.0',
        migrationTimestamp: '20260905120000',
        comment: 'Logistics OS core domain schema',
        tables: [
          {
            name: 'log_shipments',
            columns: [
              { name: 'shipment_number', type: 'text', nullable: false, unique: true },
              {
                name: 'status',
                type: 'text',
                nullable: false,
                check: "status IN ('draft', 'in-transit', 'delivered')",
              },
              { name: 'origin', type: 'jsonb', nullable: false },
              { name: 'destination', type: 'jsonb', nullable: false },
            ],
            indexes: [
              { name: 'idx_log_shipments_status', columns: ['status'] },
              { name: 'idx_log_shipments_number', columns: ['tenant_id', 'shipment_number'], unique: true },
            ],
          },
          {
            name: 'log_tracking_events',
            columns: [
              {
                name: 'shipment_id',
                type: 'uuid',
                nullable: false,
                references: {
                  table: 'log_shipments',
                  column: 'id',
                  onDelete: 'CASCADE',
                },
              },
              { name: 'event_type', type: 'text', nullable: false },
              { name: 'timestamp', type: 'timestamptz', nullable: false, default: 'now()' },
            ],
            indexes: [
              { name: 'idx_log_tracking_events_shipment', columns: ['shipment_id'] },
            ],
          },
        ],
      };

      const result = generator.generate(spec);

      // Verify structure
      expect(result.migrationFilename).toBe('20260905120000_logistics-os_schema.sql');
      expect(result.validation.tablesCreated).toBe(2);

      // Verify content
      expect(result.migrationSQL).toContain('LOGISTICS-OS — PRODUCT SCHEMA');
      expect(result.migrationSQL).toContain('log_shipments');
      expect(result.migrationSQL).toContain('log_tracking_events');
      expect(result.migrationSQL).toContain('shipment_number TEXT NOT NULL UNIQUE');
      expect(result.migrationSQL).toContain('REFERENCES log_shipments(id) ON DELETE CASCADE');
      expect(result.migrationSQL).toContain('tenant_isolation_log_shipments');
      expect(result.migrationSQL).toContain('tenant_isolation_log_tracking_events');
    });
  });
});
