/**
 * Decision Engine Platform - BI Clients
 * 
 * Concrete implementations of IBIClient for different databases.
 * 
 * @module providers/bi/clients
 */

// Mock Client (for testing)
export { MockBIClient, createMockBIClient } from './MockBIClient';

// PostgreSQL Client (requires `pg` package)
export { PostgreSQLClient, createPostgreSQLClient } from './PostgreSQLClient';

// Future clients:
// export { MySQLClient, createMySQLClient } from './MySQLClient';
// export { SQLiteClient, createSQLiteClient } from './SQLiteClient';
