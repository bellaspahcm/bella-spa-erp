/**
 * Evidence Collector for Factory Canonical Scope Derivation
 * 
 * Scans repository to collect evidence for E9 decision engine.
 * 
 * Evidence Sources (in authority order):
 * 1. DB migrations (authoritative persistence)
 * 2. Generated types (authoritative contract)
 * 3. RLS policies (authoritative governance)
 * 4. Domain implementation (evidence of intent)
 * 5. Behavioral tests (evidence of requirements)
 * 6. Historical/deleted code (evidence only, NOT authority)
 * 
 * Principles:
 * - Deterministic (same repo state → same evidence)
 * - Scope-aware (scans only relevant Industry/Kernel)
 * - Evidence-preserving (facts with audit trail)
 * - No heuristics (reports facts, does NOT decide)
 * 
 * @see docs/architecture/FACTORY_CANONICAL_SCOPE_DERIVATION.md
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import type { CanonicalEvidence } from './canonical-scope-derivation';

export interface EvidenceCollectorOptions {
  industryScope: string;              // 'education', 'healthcare', 'logistics', etc.
  migrationsPath?: string;            // Default: 'supabase/migrations'
  generatedTypesPath?: string;        // Default: 'src/types/database.types.ts'
  domainBasePath?: string;            // Default: 'src/platform'
  testBasePath?: string;              // Default: 'src/platform'
  includeHistorical?: boolean;        // Default: false (historical scan expensive)
}

/**
 * Entity name mapping patterns for different naming conventions
 */
interface EntityNamePatterns {
  table: string;           // DB table name (e.g., 'edu_courses')
  type: string;            // Generated type name (e.g., 'edu_courses')
  rls: string;             // RLS policy pattern (e.g., 'tenant_isolation_edu_courses')
  domain: string[];        // Domain file patterns (e.g., ['course.entity.ts', 'course.aggregate.ts'])
  test: string[];          // Test file patterns
}

/**
 * Derive entity naming patterns from entity name and industry scope
 */
function deriveEntityPatterns(
  entityName: string,
  industryScope: string,
  migrationsPath: string,
  typesPath: string
): EntityNamePatterns {
  const lowerEntity = entityName.toLowerCase();
  const scopePrefix = getScopePrefix(industryScope, migrationsPath, typesPath);
  
  // Table name: try both singular and plural patterns
  // Some tables use singular (edu_attendance), some use plural (edu_courses)
  const tableName = `${scopePrefix}_${lowerEntity}`;
  
  // Type name matches table name in generated types
  const typeName = tableName;
  
  // RLS policy: tenant_isolation_{table_name}
  const rlsPolicy = `tenant_isolation_${tableName}`;
  
  // Domain files: entity/aggregate variations
  const domainPatterns = [
    `${lowerEntity}.entity.ts`,
    `${lowerEntity}.aggregate.ts`,
    `${lowerEntity}.ts`,
  ];
  
  // Test files
  const testPatterns = [
    `${lowerEntity}.test.ts`,
    `${lowerEntity}.domain.test.ts`,
    `${lowerEntity}.entity.test.ts`,
    `${lowerEntity}.aggregate.test.ts`,
  ];
  
  return {
    table: tableName,
    type: typeName,
    rls: rlsPolicy,
    domain: domainPatterns,
    test: testPatterns,
  };
}

/**
 * Discover actual table prefixes from migrations/types
 * 
 * Scans for CREATE TABLE statements to identify industry-specific prefixes.
 * Returns discovered prefix or throws if ambiguous.
 * 
 * @param industryScope - Industry name (e.g., 'automotive', 'education')
 * @param migrationsPath - Path to migration files
 * @param typesPath - Path to generated types
 * @returns Discovered prefix (e.g., 'auto', 'edu') or BLOCK
 */
function discoverScopePrefix(
  industryScope: string,
  migrationsPath: string,
  typesPath: string
): { prefix: string; source: 'migrations' | 'types' | 'hardcoded' | 'unknown' } {
  // Try migrations first (authoritative)
  const migrationsPrefix = discoverPrefixFromMigrations(industryScope, migrationsPath);
  if (migrationsPrefix) {
    return { prefix: migrationsPrefix, source: 'migrations' };
  }
  
  // Try generated types (canonical contract)
  const typesPrefix = discoverPrefixFromTypes(industryScope, typesPath);
  if (typesPrefix) {
    return { prefix: typesPrefix, source: 'types' };
  }
  
  // Fallback to hardcoded map (legacy support)
  const hardcodedPrefix = getHardcodedPrefix(industryScope);
  if (hardcodedPrefix) {
    return { prefix: hardcodedPrefix, source: 'hardcoded' };
  }
  
  // Cannot determine prefix → BLOCK
  return { prefix: '', source: 'unknown' };
}

/**
 * Scan migrations for industry-specific table prefixes
 */
function discoverPrefixFromMigrations(industryScope: string, migrationsPath: string): string | null {
  if (!existsSync(migrationsPath)) {
    return null;
  }
  
  const migrationFiles = readdirSync(migrationsPath)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  const prefixCandidates = new Set<string>();
  
  // Extract table prefixes from CREATE TABLE statements
  for (const file of migrationFiles) {
    const content = readFileSync(join(migrationsPath, file), 'utf-8');
    
    // Match: CREATE TABLE [IF NOT EXISTS] [schema.]prefix_tablename
    const tableMatches = content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z]+)_[a-z_]+/gi);
    
    for (const match of tableMatches) {
      const prefix = match[1].toLowerCase();
      
      // Filter out known platform/system prefixes
      if (!['migration', 'platform', 'api', 'auth', 'storage'].includes(prefix)) {
        prefixCandidates.add(prefix);
      }
    }
  }
  
  // Match industry name to discovered prefixes
  const industryLower = industryScope.toLowerCase();
  
  // Strategy: Try longest match first to avoid prefix collisions
  // Example: "retail" should match "retail_" not "re_" (real-estate)
  
  // 1. Exact full industry scope match (highest priority)
  //    "retail" → "retail_products" ✅
  if (prefixCandidates.has(industryLower)) {
    return industryLower;
  }
  
  // 2. Exact prefix of industry scope
  //    "education" → "edu_courses" ✅
  const sortedByLength = Array.from(prefixCandidates).sort((a, b) => b.length - a.length);
  for (const prefix of sortedByLength) {
    if (industryLower.startsWith(prefix)) {
      return prefix;
    }
  }
  
  // 3. Industry scope is prefix of candidate
  //    "auto" → "automotive_services" (if no "auto_" tables exist)
  for (const prefix of sortedByLength) {
    if (prefix.startsWith(industryLower)) {
      return prefix;
    }
  }
  
  // 4. Single candidate (unambiguous)
  if (prefixCandidates.size === 1) {
    return Array.from(prefixCandidates)[0];
  }
  
  // 5. No match found
  return null;
}

/**
 * Scan generated types for industry-specific table prefixes
 */
function discoverPrefixFromTypes(industryScope: string, typesPath: string): string | null {
  if (!existsSync(typesPath)) {
    return null;
  }
  
  const content = readFileSync(typesPath, 'utf-8');
  const industryLower = industryScope.toLowerCase();
  const prefixCandidates = new Set<string>();
  
  // Extract table names from Database['public'] type structure
  // Look for patterns like: auto_brands: { Row: ... }
  const tableMatches = content.matchAll(/\s+([a-z]+)_[a-z_]+\s*:\s*\{/g);
  
  for (const match of tableMatches) {
    const prefix = match[1].toLowerCase();
    
    // Filter out system prefixes
    if (!['migration', 'platform', 'api', 'auth', 'storage'].includes(prefix)) {
      prefixCandidates.add(prefix);
    }
  }
  
  // Match industry to prefix
  for (const prefix of prefixCandidates) {
    if (industryLower.startsWith(prefix) || prefix === industryLower) {
      return prefix;
    }
  }
  
  // Single candidate
  if (prefixCandidates.size === 1) {
    return Array.from(prefixCandidates)[0];
  }
  
  return null;
}

/**
 * Hardcoded prefix mapping (legacy support)
 * 
 * DEPRECATED: Only used as fallback when auto-discovery fails.
 * New industries should be auto-discovered from canonical evidence.
 */
function getHardcodedPrefix(industryScope: string): string | null {
  const prefixMap: Record<string, string> = {
    education: 'edu',
    healthcare: 'hc',
    logistics: 'log',
    finance: 'fin',
    'real-estate': 're',
  };
  
  return prefixMap[industryScope.toLowerCase()] || null;
}

/**
 * Get scope prefix for industry (e.g., 'edu', 'hc', 'log', 'auto')
 * 
 * AUTO-DISCOVERS prefix from canonical evidence instead of hardcoding.
 * 
 * Discovery Order:
 * 1. Migrations (CREATE TABLE statements) ✅ Authoritative
 * 2. Generated types (database.types.ts) ✅ Canonical contract
 * 3. Hardcoded map (legacy industries) ⚠️ Fallback only
 * 4. UNKNOWN → BLOCK ❌ Do not guess
 * 
 * @throws Error if prefix cannot be determined (BLOCK rather than guess wrong)
 */
function getScopePrefix(industryScope: string, migrationsPath: string, typesPath: string): string {
  const discovery = discoverScopePrefix(industryScope, migrationsPath, typesPath);
  
  if (discovery.source === 'unknown') {
    throw new Error(
      `Cannot determine table prefix for industry '${industryScope}'. ` +
      `No matching tables found in migrations or types. ` +
      `Factory BLOCKS rather than guessing wrong prefix.`
    );
  }
  
  // Log discovery source for transparency
  if (discovery.source === 'hardcoded') {
    console.warn(`⚠️  Using hardcoded prefix '${discovery.prefix}' for ${industryScope} (legacy fallback)`);
  } else {
    console.log(`✅ Auto-discovered prefix '${discovery.prefix}' for ${industryScope} (source: ${discovery.source})`);
  }
  
  return discovery.prefix;
}

/**
 * Simple pluralization (good enough for most entity names)
 */
function pluralize(word: string): string {
  if (word.endsWith('s')) return word + 'es';
  if (word.endsWith('y')) return word.slice(0, -1) + 'ies';
  if (word.endsWith('ss')) return word + 'es';
  return word + 's';
}

/**
 * Scan migrations directory for table creation evidence
 */
function checkMigrationEvidence(patterns: EntityNamePatterns, migrationsPath: string): boolean {
  if (!existsSync(migrationsPath)) {
    return false;
  }
  
  const migrationFiles = readdirSync(migrationsPath)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  for (const file of migrationFiles) {
    const content = readFileSync(join(migrationsPath, file), 'utf-8');
    
    // Check for table creation - try both singular and plural
    const createTablePattern = new RegExp(`CREATE\\s+TABLE.*${patterns.table}`, 'i');
    if (createTablePattern.test(content)) {
      return true;
    }
    
    // Also try pluralized version
    const pluralTable = patterns.table.replace(/_([^_]+)$/, (_, last) => '_' + pluralize(last));
    if (pluralTable !== patterns.table) {
      const pluralPattern = new RegExp(`CREATE\\s+TABLE.*${pluralTable}`, 'i');
      if (pluralPattern.test(content)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Scan generated types file for type evidence
 */
function checkGeneratedTypeEvidence(patterns: EntityNamePatterns, typesPath: string): boolean {
  if (!existsSync(typesPath)) {
    return false;
  }
  
  const content = readFileSync(typesPath, 'utf-8');
  
  // Check for type definition or interface - try both singular and plural
  const typePattern = new RegExp(`(export\\s+type|export\\s+interface)\\s+${patterns.type}`, 'i');
  if (typePattern.test(content)) {
    return true;
  }
  
  // Check within Database type structure
  const dbTypePattern = new RegExp(`${patterns.type}\\s*:`, 'i');
  if (dbTypePattern.test(content)) {
    return true;
  }
  
  // Also try pluralized version
  const pluralType = patterns.type.replace(/_([^_]+)$/, (_, last) => '_' + pluralize(last));
  if (pluralType !== patterns.type) {
    const pluralTypePattern = new RegExp(`(export\\s+type|export\\s+interface)\\s+${pluralType}`, 'i');
    if (pluralTypePattern.test(content)) {
      return true;
    }
    
    const pluralDbPattern = new RegExp(`${pluralType}\\s*:`, 'i');
    if (pluralDbPattern.test(content)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Scan migrations for RLS policy evidence
 */
function checkRLSEvidence(patterns: EntityNamePatterns, migrationsPath: string): boolean {
  if (!existsSync(migrationsPath)) {
    return false;
  }
  
  const migrationFiles = readdirSync(migrationsPath)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  for (const file of migrationFiles) {
    const content = readFileSync(join(migrationsPath, file), 'utf-8');
    
    // Check for RLS enable - try both singular and plural
    const enableRLSPattern = new RegExp(`ALTER\\s+TABLE.*${patterns.table}.*ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
    if (enableRLSPattern.test(content)) {
      return true;
    }
    
    // Check for tenant isolation policy
    const policyPattern = new RegExp(`CREATE\\s+POLICY\\s+${patterns.rls}`, 'i');
    if (policyPattern.test(content)) {
      return true;
    }
    
    // Check for any policy on the table
    const tablePolicyPattern = new RegExp(`CREATE\\s+POLICY.*ON.*${patterns.table}`, 'i');
    if (tablePolicyPattern.test(content)) {
      return true;
    }
    
    // Also try pluralized version
    const pluralTable = patterns.table.replace(/_([^_]+)$/, (_, last) => '_' + pluralize(last));
    if (pluralTable !== patterns.table) {
      const pluralEnableRLS = new RegExp(`ALTER\\s+TABLE.*${pluralTable}.*ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
      if (pluralEnableRLS.test(content)) {
        return true;
      }
      
      const pluralRlsPolicy = `tenant_isolation_${pluralTable}`;
      const pluralPolicyPattern = new RegExp(`CREATE\\s+POLICY\\s+${pluralRlsPolicy}`, 'i');
      if (pluralPolicyPattern.test(content)) {
        return true;
      }
      
      const pluralTablePolicy = new RegExp(`CREATE\\s+POLICY.*ON.*${pluralTable}`, 'i');
      if (pluralTablePolicy.test(content)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Scan domain directory for entity implementation
 */
function checkDomainEvidence(
  patterns: EntityNamePatterns,
  domainBasePath: string,
  industryScope: string
): boolean {
  const domainPath = join(domainBasePath, industryScope, 'domain');
  
  if (!existsSync(domainPath)) {
    return false;
  }
  
  for (const pattern of patterns.domain) {
    const filePath = join(domainPath, pattern);
    if (existsSync(filePath)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Scan test directory for behavioral tests
 */
function checkTestEvidence(
  patterns: EntityNamePatterns,
  testBasePath: string,
  industryScope: string
): boolean {
  const testPath = join(testBasePath, industryScope, 'domain', '__tests__');
  
  if (!existsSync(testPath)) {
    return false;
  }
  
  for (const pattern of patterns.test) {
    const filePath = join(testPath, pattern);
    if (existsSync(filePath)) {
      return true;
    }
  }
  
  // Also check for combined test files (e.g., course-enrollment.domain.test.ts)
  const testFiles = readdirSync(testPath);
  const lowerEntity = patterns.domain[0].split('.')[0]; // Extract base entity name
  
  for (const file of testFiles) {
    if (file.includes(lowerEntity) && file.endsWith('.test.ts')) {
      return true;
    }
  }
  
  return false;
}

/**
 * Collect canonical evidence for an entity from repository
 * 
 * @param entityName Entity to analyze (e.g., 'Course', 'Attendance')
 * @param options Evidence collection options
 * @returns Canonical evidence for E9 decision engine
 */
export async function collectEvidence(
  entityName: string,
  options: EvidenceCollectorOptions
): Promise<CanonicalEvidence> {
  const {
    industryScope,
    migrationsPath = 'supabase/migrations',
    generatedTypesPath = 'src/types/database.types.ts',
    domainBasePath = 'src/platform',
    testBasePath = 'src/platform',
    includeHistorical = false,
  } = options;
  
  // Derive naming patterns
  const patterns = deriveEntityPatterns(
    entityName,
    industryScope,
    migrationsPath,
    generatedTypesPath
  );
  
  // Collect evidence from each source
  const migration = checkMigrationEvidence(patterns, migrationsPath);
  const generatedTypes = checkGeneratedTypeEvidence(patterns, generatedTypesPath);
  const rls = checkRLSEvidence(patterns, migrationsPath);
  const domain = checkDomainEvidence(patterns, domainBasePath, industryScope);
  const tests = checkTestEvidence(patterns, testBasePath, industryScope);
  
  // Historical evidence collection deferred (expensive git operation)
  const historical = includeHistorical ? undefined : undefined;
  
  const evidence: CanonicalEvidence = {
    migration,
    generatedTypes,
    rls,
    domain,
    tests,
    historical,
  };
  
  return evidence;
}

/**
 * Collect evidence for all entities in an industry scope
 * 
 * @param industryScope Industry to scan (e.g., 'education')
 * @param options Evidence collection options
 * @returns Map of entity name to evidence
 */
export async function collectIndustryEvidence(
  industryScope: string,
  options: Partial<EvidenceCollectorOptions> = {}
): Promise<Map<string, CanonicalEvidence>> {
  const fullOptions: EvidenceCollectorOptions = {
    industryScope,
    ...options,
  };
  
  // Discover entities from migrations (most authoritative source)
  const entities = discoverEntitiesFromMigrations(
    fullOptions.migrationsPath || 'supabase/migrations',
    industryScope,
    fullOptions.generatedTypesPath || 'src/types/database.types.ts'
  );
  
  const evidenceMap = new Map<string, CanonicalEvidence>();
  
  for (const entityName of entities) {
    const evidence = await collectEvidence(entityName, fullOptions);
    evidenceMap.set(entityName, evidence);
  }
  
  return evidenceMap;
}

/**
 * Discover entity names from migrations
 */
function discoverEntitiesFromMigrations(
  migrationsPath: string,
  industryScope: string,
  typesPath: string
): string[] {
  if (!existsSync(migrationsPath)) {
    return [];
  }
  
  const scopePrefix = getScopePrefix(industryScope, migrationsPath, typesPath);
  const entities = new Set<string>();
  
  const migrationFiles = readdirSync(migrationsPath)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  for (const file of migrationFiles) {
    const content = readFileSync(join(migrationsPath, file), 'utf-8');
    
    // Match CREATE TABLE statements with scope prefix
    const createTablePattern = new RegExp(`CREATE\\s+TABLE[^(]*\\b(${scopePrefix}_\\w+)`, 'gi');
    const matches = content.matchAll(createTablePattern);
    
    for (const match of matches) {
      const tableName = match[1];
      // Convert table name to entity name
      // e.g., edu_courses → Course, edu_enrollments → Enrollment
      const entityName = tableNameToEntityName(tableName, scopePrefix);
      entities.add(entityName);
    }
  }
  
  return Array.from(entities).sort();
}

/**
 * Convert table name to entity name
 * e.g., edu_courses → Course, edu_attendance → Attendance
 */
function tableNameToEntityName(tableName: string, scopePrefix: string): string {
  // Remove scope prefix
  const withoutPrefix = tableName.replace(new RegExp(`^${scopePrefix}_`), '');
  
  // De-pluralize
  let singular = depluralizeSimple(withoutPrefix);
  
  // Capitalize first letter
  return singular.charAt(0).toUpperCase() + singular.slice(1);
}

/**
 * Simple de-pluralization
 */
function depluralizeSimple(word: string): string {
  if (word.endsWith('ies') && word.length > 4) {
    return word.slice(0, -3) + 'y';
  }
  if (word.endsWith('sses')) {
    return word.slice(0, -2);
  }
  if (word.endsWith('xes') || word.endsWith('zes') || word.endsWith('ches') || word.endsWith('shes')) {
    return word.slice(0, -2);
  }
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 2) {
    return word.slice(0, -1);
  }
  return word;
}
