/**
 * BDGF Check Registry
 * 
 * Central registry of check types with execution logic.
 * Gates use this to execute checks in a standardized way.
 * 
 * @module bdgf/check-registry
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Check executor function type
 * @callback CheckExecutor
 * @param {Object} config - Check configuration
 * @returns {Promise<CheckResult>} Check result
 */

/**
 * Check result structure
 * @typedef {Object} CheckResult
 * @property {string} checkId - Check identifier
 * @property {string} checkName - Check name
 * @property {'PASS'|'FAIL'|'WARN'} status - Check status
 * @property {*} evidence - Evidence object
 * @property {string} message - Result message
 * @property {string} timestamp - ISO8601 timestamp
 * @property {number} duration - Execution duration in milliseconds
 */

/**
 * Singleton registry for check types
 */
class CheckRegistryClass {
  constructor() {
    this.checkTypes = new Map();
    this.registerBuiltInCheckTypes();
  }

  /**
   * Register a check type
   * 
   * @param {string} typeName - Check type name
   * @param {CheckExecutor} executor - Execution function
   * @param {Object} [schema] - JSON schema for config validation
   */
  register(typeName, executor, schema = null) {
    if (this.checkTypes.has(typeName)) {
      console.warn(`Check type "${typeName}" already registered, overwriting...`);
    }

    this.checkTypes.set(typeName, {
      executor,
      schema
    });
  }

  /**
   * Execute a check
   * 
   * @param {string} typeName - Check type name
   * @param {Object} config - Check configuration
   * @returns {Promise<CheckResult>} Check result
   */
  async execute(typeName, config) {
    const checkType = this.checkTypes.get(typeName);
    if (!checkType) {
      throw new Error(`Unknown check type: ${typeName}`);
    }

    const startTime = Date.now();

    try {
      const result = await checkType.executor(config);
      const duration = Date.now() - startTime;

      return {
        checkId: config.id || 'unknown',
        checkName: config.name || typeName,
        ...result,
        timestamp: new Date().toISOString(),
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        checkId: config.id || 'unknown',
        checkName: config.name || typeName,
        status: 'FAIL',
        evidence: { error: error.message, stack: error.stack },
        message: `Check execution failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        duration
      };
    }
  }

  /**
   * Check if a type is registered
   * 
   * @param {string} typeName - Check type name
   * @returns {boolean} True if registered
   */
  has(typeName) {
    return this.checkTypes.has(typeName);
  }

  /**
   * Get list of registered check types
   * 
   * @returns {string[]} Array of check type names
   */
  getRegisteredTypes() {
    return Array.from(this.checkTypes.keys());
  }

  /**
   * Register built-in check types
   * @private
   */
  registerBuiltInCheckTypes() {
    // File existence check
    this.register('file-existence', async (config) => {
      const { files } = config;
      const missing = [];

      for (const file of files) {
        try {
          await fs.access(file);
        } catch {
          missing.push(file);
        }
      }

      if (missing.length > 0) {
        return {
          status: 'FAIL',
          evidence: { missing },
          message: `Missing files: ${missing.join(', ')}`
        };
      }

      return {
        status: 'PASS',
        evidence: { files },
        message: `All ${files.length} files exist`
      };
    });

    // Regex match check
    this.register('regex-match', async (config) => {
      const { target, pattern, failOn } = config;
      const files = await glob(target);
      const matches = [];
      const nonMatches = [];

      const regex = new RegExp(pattern);

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        if (regex.test(content)) {
          matches.push(file);
        } else {
          nonMatches.push(file);
        }
      }

      if (failOn === 'not-found' && nonMatches.length > 0) {
        return {
          status: 'FAIL',
          evidence: { pattern, matches, nonMatches },
          message: `Pattern not found in ${nonMatches.length} files`
        };
      }

      if (failOn === 'found' && matches.length > 0) {
        return {
          status: 'FAIL',
          evidence: { pattern, matches },
          message: `Pattern found in ${matches.length} files (anti-pattern)`
        };
      }

      return {
        status: 'PASS',
        evidence: { pattern, matchCount: matches.length, totalFiles: files.length },
        message: `Pattern check passed`
      };
    });

    // Negative match (anti-pattern) check
    this.register('negative-match', async (config) => {
      const { target, antipattern, failOn } = config;
      const files = await glob(target);
      const found = [];

      const regex = new RegExp(antipattern);

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        if (regex.test(content)) {
          found.push(file);
        }
      }

      if (failOn === 'found' && found.length > 0) {
        return {
          status: 'FAIL',
          evidence: { antipattern, found },
          message: `Anti-pattern found in ${found.length} files`
        };
      }

      return {
        status: 'PASS',
        evidence: { antipattern, filesChecked: files.length },
        message: `Anti-pattern not found`
      };
    });

    // Schema query check
    this.register('schema-query', async (config) => {
      const { query, expect } = config;
      const client = await this.getDatabaseClient();

      try {
        const result = await client.query(query);

        // Check expectations
        for (const [key, expectedValue] of Object.entries(expect)) {
          const actualValue = result.rows[0]?.[key];

          if (actualValue !== expectedValue) {
            return {
              status: 'FAIL',
              evidence: { query, expected: expect, actual: result.rows[0] },
              message: `Expected ${key}=${expectedValue}, got ${actualValue}`
            };
          }
        }

        return {
          status: 'PASS',
          evidence: { query, result: result.rows[0] },
          message: `Schema query passed`
        };
      } finally {
        await client.end();
      }
    });

    // Data query check
    this.register('data-query', async (config) => {
      const { query, expect } = config;
      const client = await this.getDatabaseClient();

      try {
        const result = await client.query(query);

        // Support different expectation types
        if (expect.count !== undefined) {
          const actualCount = parseInt(result.rows[0]?.count || result.rows.length);

          if (typeof expect.count === 'object') {
            // Range check
            if (expect.count['>='] !== undefined && actualCount < expect.count['>=']) {
              return {
                status: 'FAIL',
                evidence: { query, expected: expect.count, actual: actualCount },
                message: `Expected count >= ${expect.count['>=']}, got ${actualCount}`
              };
            }
            if (expect.count['<='] !== undefined && actualCount > expect.count['<=']) {
              return {
                status: 'FAIL',
                evidence: { query, expected: expect.count, actual: actualCount },
                message: `Expected count <= ${expect.count['<=']}, got ${actualCount}`
              };
            }
          } else {
            // Exact count
            if (actualCount !== expect.count) {
              return {
                status: 'FAIL',
                evidence: { query, expected: expect.count, actual: actualCount },
                message: `Expected count ${expect.count}, got ${actualCount}`
              };
            }
          }
        }

        return {
          status: 'PASS',
          evidence: { query, result: result.rows },
          message: `Data query passed`
        };
      } finally {
        await client.end();
      }
    });

    // Fixture count check
    this.register('fixture-count', async (config) => {
      const { table, expectedCount } = config;
      const client = await this.getDatabaseClient();

      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        const actualCount = parseInt(result.rows[0].count);

        if (actualCount !== expectedCount) {
          return {
            status: 'FAIL',
            evidence: { table, expected: expectedCount, actual: actualCount },
            message: `Expected ${expectedCount} fixtures, got ${actualCount}`
          };
        }

        return {
          status: 'PASS',
          evidence: { table, count: actualCount },
          message: `Fixture count correct: ${actualCount}`
        };
      } finally {
        await client.end();
      }
    });

    // RLS state check
    this.register('rls-state', async (config) => {
      const { table, expectEnabled } = config;
      const client = await this.getDatabaseClient();

      try {
        const result = await client.query(
          `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = $1`,
          [table]
        );

        if (result.rows.length === 0) {
          return {
            status: 'FAIL',
            evidence: { table },
            message: `Table not found: ${table}`
          };
        }

        const rlsEnabled = result.rows[0].rowsecurity;

        if (rlsEnabled !== expectEnabled) {
          return {
            status: 'FAIL',
            evidence: { table, expected: expectEnabled, actual: rlsEnabled },
            message: `Expected RLS ${expectEnabled ? 'enabled' : 'disabled'}, got ${rlsEnabled ? 'enabled' : 'disabled'}`
          };
        }

        return {
          status: 'PASS',
          evidence: { table, rlsEnabled },
          message: `RLS state correct`
        };
      } finally {
        await client.end();
      }
    });

    // File parser check (basic syntax validation)
    this.register('file-parser', async (config) => {
      const { target, validator } = config;
      const files = await glob(target);
      const errors = [];

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');

        // Basic SQL syntax check (can be extended)
        if (validator === 'sql-parser') {
          // Check for common syntax errors
          if (content.includes(';;')) {
            errors.push({ file, error: 'Double semicolon detected' });
          }
          // Add more validation as needed
        }
      }

      if (errors.length > 0) {
        return {
          status: 'FAIL',
          evidence: { errors },
          message: `Syntax errors found in ${errors.length} files`
        };
      }

      return {
        status: 'PASS',
        evidence: { filesChecked: files.length },
        message: `All files parsed successfully`
      };
    });

    // ========================================================================
    // DATABASE GOVERNANCE PRIMITIVES (Added for G3a Layer 2.2)
    // ========================================================================

    // Database table existence check
    this.register('database-table-exists', async (config) => {
      const { schema = 'public', tableName, expectExists = true } = config;
      const client = await this.getDatabaseClient();

      try {
        const result = await client.query(
          `SELECT EXISTS(
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = $1 AND table_name = $2
          ) AS exists`,
          [schema, tableName]
        );

        const exists = result.rows[0].exists;

        if (exists !== expectExists) {
          return {
            status: 'FAIL',
            evidence: { schema, tableName, exists, expected: expectExists },
            message: expectExists 
              ? `Table ${schema}.${tableName} does not exist`
              : `Table ${schema}.${tableName} exists (expected not to exist)`
          };
        }

        return {
          status: 'PASS',
          evidence: { schema, tableName, exists },
          message: expectExists
            ? `Table ${schema}.${tableName} exists`
            : `Table ${schema}.${tableName} does not exist (as expected)`
        };
      } finally {
        await client.end();
      }
    });

    // Database column type check
    this.register('database-column-type', async (config) => {
      const { schema = 'public', tableName, columnName, expectedTypes } = config;
      const client = await this.getDatabaseClient();

      try {
        const result = await client.query(
          `SELECT data_type FROM information_schema.columns
           WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
          [schema, tableName, columnName]
        );

        if (result.rows.length === 0) {
          return {
            status: 'FAIL',
            evidence: { schema, tableName, columnName },
            message: `Column ${schema}.${tableName}.${columnName} not found`
          };
        }

        const actualType = result.rows[0].data_type;

        // Support array of expected types (for aliases like text/character varying)
        const expectedTypeList = Array.isArray(expectedTypes) ? expectedTypes : [expectedTypes];

        if (!expectedTypeList.includes(actualType)) {
          return {
            status: 'FAIL',
            evidence: { schema, tableName, columnName, expected: expectedTypeList, actual: actualType },
            message: `Column ${schema}.${tableName}.${columnName} type is ${actualType}, expected ${expectedTypeList.join(' or ')}`
          };
        }

        return {
          status: 'PASS',
          evidence: { schema, tableName, columnName, dataType: actualType },
          message: `Column ${schema}.${tableName}.${columnName} type is ${actualType}`
        };
      } finally {
        await client.end();
      }
    });

    // Database schema existence check
    this.register('database-schema-exists', async (config) => {
      const { schemaName, expectExists = true } = config;
      const client = await this.getDatabaseClient();

      try {
        const result = await client.query(
          `SELECT EXISTS(
            SELECT 1 FROM information_schema.schemata
            WHERE schema_name = $1
          ) AS exists`,
          [schemaName]
        );

        const exists = result.rows[0].exists;

        if (exists !== expectExists) {
          return {
            status: 'FAIL',
            evidence: { schemaName, exists, expected: expectExists },
            message: expectExists
              ? `Schema ${schemaName} does not exist`
              : `Schema ${schemaName} exists (expected not to exist)`
          };
        }

        return {
          status: 'PASS',
          evidence: { schemaName, exists },
          message: expectExists
            ? `Schema ${schemaName} exists`
            : `Schema ${schemaName} does not exist (as expected)`
        };
      } finally {
        await client.end();
      }
    });

    // Database query check (execute parameterized query and verify results)
    this.register('database-query', async (config) => {
      const { query, params = [], expectedResult } = config;
      const client = await this.getDatabaseClient();

      try {
        const result = await client.query(query, params);

        if (!result.rows || result.rows.length === 0) {
          if (expectedResult) {
            return {
              status: 'FAIL',
              evidence: { query, params, result: null, expected: expectedResult },
              message: `Query returned no results, expected ${JSON.stringify(expectedResult)}`
            };
          }

          return {
            status: 'PASS',
            evidence: { query, params, result: null },
            message: `Query returned no results (as expected)`
          };
        }

        const actualResult = result.rows[0];

        // Verify expected result (if provided)
        if (expectedResult) {
          for (const [key, expectedValue] of Object.entries(expectedResult)) {
            const actualValue = actualResult[key];

            // Handle numeric comparisons (count often comes back as string)
            const normalizedActual = typeof actualValue === 'string' && !isNaN(actualValue)
              ? parseInt(actualValue)
              : actualValue;
            const normalizedExpected = typeof expectedValue === 'string' && !isNaN(expectedValue)
              ? parseInt(expectedValue)
              : expectedValue;

            if (normalizedActual !== normalizedExpected) {
              return {
                status: 'FAIL',
                evidence: { query, params, expected: expectedResult, actual: actualResult },
                message: `Query result mismatch: ${key} = ${normalizedActual}, expected ${normalizedExpected}`
              };
            }
          }
        }

        return {
          status: 'PASS',
          evidence: { query, params, result: actualResult },
          message: `Query executed successfully`
        };
      } finally {
        await client.end();
      }
    });

    // Database version check
    this.register('database-version', async (config) => {
      const { minVersion, expectedDatabase = 'postgresql' } = config;
      const client = await this.getDatabaseClient();

      try {
        const result = await client.query('SHOW server_version');
        const version = result.rows[0].server_version;

        // Parse version (e.g., "17.6 (Ubuntu 17.6-1.pgdg20.04+1)" -> 17.6)
        const versionMatch = version.match(/^(\d+)\.(\d+)/);
        if (!versionMatch) {
          return {
            status: 'FAIL',
            evidence: { version },
            message: `Unable to parse database version: ${version}`
          };
        }

        const majorVersion = parseInt(versionMatch[1]);
        const minorVersion = parseInt(versionMatch[2]);
        const actualVersion = `${majorVersion}.${minorVersion}`;

        // Parse min version
        const minVersionMatch = minVersion.match(/^(\d+)(?:\.(\d+))?/);
        const minMajor = parseInt(minVersionMatch[1]);
        const minMinor = parseInt(minVersionMatch[2] || 0);

        // Version comparison
        if (majorVersion < minMajor || (majorVersion === minMajor && minorVersion < minMinor)) {
          return {
            status: 'FAIL',
            evidence: { version: actualVersion, minVersion, fullVersion: version },
            message: `Database version ${actualVersion} is below minimum ${minVersion}`
          };
        }

        return {
          status: 'PASS',
          evidence: { version: actualVersion, minVersion, fullVersion: version, database: expectedDatabase },
          message: `Database version ${actualVersion} meets minimum ${minVersion}`
        };
      } finally {
        await client.end();
      }
    });

    // Database privilege check
    this.register('database-privilege', async (config) => {
      const { privileges } = config;
      const client = await this.getDatabaseClient();

      try {
        const results = [];
        const failures = [];

        for (const priv of privileges) {
          if (priv.type === 'schema') {
            // Check schema-level privilege
            const result = await client.query(
              `SELECT has_schema_privilege(CURRENT_USER, $1, $2) as has_privilege`,
              [priv.name, priv.privilege]
            );

            const hasPrivilege = result.rows[0].has_privilege;
            results.push({ type: 'schema', name: priv.name, privilege: priv.privilege, hasPrivilege });

            if (!hasPrivilege) {
              failures.push(`Missing ${priv.privilege} on schema ${priv.name}`);
            }
          } else if (priv.type === 'database') {
            // Check database-level privilege
            const result = await client.query(
              `SELECT has_database_privilege(CURRENT_DATABASE(), $1) as has_privilege`,
              [priv.privilege]
            );

            const hasPrivilege = result.rows[0].has_privilege;
            results.push({ type: 'database', privilege: priv.privilege, hasPrivilege });

            if (!hasPrivilege) {
              failures.push(`Missing ${priv.privilege} on database`);
            }
          } else if (priv.type === 'table') {
            // Check table-level privilege
            const result = await client.query(
              `SELECT has_table_privilege(CURRENT_USER, $1, $2) as has_privilege`,
              [priv.name, priv.privilege]
            );

            const hasPrivilege = result.rows[0].has_privilege;
            results.push({ type: 'table', name: priv.name, privilege: priv.privilege, hasPrivilege });

            if (!hasPrivilege) {
              failures.push(`Missing ${priv.privilege} on table ${priv.name}`);
            }
          }
        }

        if (failures.length > 0) {
          return {
            status: 'FAIL',
            evidence: { privileges: results, failures },
            message: `Insufficient privileges: ${failures.join(', ')}`
          };
        }

        return {
          status: 'PASS',
          evidence: { privileges: results },
          message: `All required privileges present`
        };
      } finally {
        await client.end();
      }
    });

    // Custom check type (for domain-specific validation logic)
    this.register('custom', async (config) => {
      const { validator } = config;

      // E2-before-delete ordering validator (Amendment 12 specific)
      if (validator === 'e2-before-delete-ordering') {
        const { file, pattern1, pattern2 } = config;
        const content = await fs.readFile(file, 'utf-8');

        const regex1 = new RegExp(pattern1);
        const regex2 = new RegExp(pattern2);

        const match1 = content.search(regex1);
        const match2 = content.search(regex2);

        if (match1 === -1) {
          return {
            status: 'FAIL',
            evidence: { file, pattern1, found: false },
            message: `Pattern 1 not found: ${pattern1}`
          };
        }

        if (match2 === -1) {
          return {
            status: 'FAIL',
            evidence: { file, pattern2, found: false },
            message: `Pattern 2 not found: ${pattern2}`
          };
        }

        if (match1 >= match2) {
          return {
            status: 'FAIL',
            evidence: { file, pattern1Position: match1, pattern2Position: match2 },
            message: `Pattern 1 must appear before Pattern 2 (ordering violation)`
          };
        }

        return {
          status: 'PASS',
          evidence: { file, pattern1Position: match1, pattern2Position: match2 },
          message: `Ordering verified: Pattern 1 appears before Pattern 2`
        };
      }

      // Unknown validator
      return {
        status: 'FAIL',
        evidence: { validator },
        message: `Unknown custom validator: ${validator}`
      };
    });
  }

  /**
   * Get database client
   * @private
   * @returns {Promise<pg.Client>} PostgreSQL client
   */
  async getDatabaseClient() {
    const client = new pg.Client({
      connectionString: process.env.DATABASE_URL
    });
    await client.connect();
    return client;
  }
}

// Singleton instance
const CheckRegistry = new CheckRegistryClass();

export { CheckRegistry };
