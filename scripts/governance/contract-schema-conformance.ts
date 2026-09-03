#!/usr/bin/env tsx
/**
 * Contract-Schema Conformance Gate MVP
 * 
 * Purpose: Detect drift between Contract and DB Schema BEFORE implementation
 * 
 * NOT a migration generator. NOT a schema repair tool.
 * Answers: "Do Contract and Schema conform according to current evidence?"
 * 
 * Scope: 4 core checks only
 * - Contract existence / ownership
 * - Schema field presence
 * - Enum / state vocabulary
 * - Generated DB type consistency
 * 
 * Verdicts:
 * - PASS: Contract + Schema + generated types conform
 * - FAIL: Objective mismatch detected
 * - REVIEW_REQUIRED: Mismatch exists but semantic owner/mapping unclear
 * 
 * Evidence Priority:
 * 1. Migration / canonical DB schema (schema truth)
 * 2. database.types.ts (generated from DB, shows current state)
 * 3. Canonical public contract + ownership (contract truth)
 * 4. Repository/service usage (behavioral evidence)
 * 5. Tests
 * 6. Docs/ADR (intent only, NOT override)
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

type Verdict = 'PASS' | 'FAIL' | 'REVIEW_REQUIRED';

interface CheckResult {
  check: string;
  verdict: Verdict;
  details?: string[];
  blockers?: string[];
}

interface GateResult {
  verdict: Verdict;
  checks: CheckResult[];
  summary: string[];
}

interface ContractDefinition {
  name: string;
  path: string;
  fields: string[];
  enums?: Record<string, string[]>;
  states?: string[];
}

interface SchemaDefinition {
  table: string;
  path: string;
  columns: string[];
  enums?: Record<string, string[]>;
}

// ============================================================================
// Evidence Discovery
// ============================================================================

/**
 * Find contract files in platform scope
 */
function findContractFiles(scope: string): string[] {
  const contractPath = path.join(process.cwd(), 'src', 'platform', scope, 'contracts');
  if (!fs.existsSync(contractPath)) return [];
  
  return fs.readdirSync(contractPath)
    .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map(f => path.join(contractPath, f));
}

/**
 * Find migration files for scope
 */
function findMigrationFiles(scope: string): string[] {
  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations');
  if (!fs.existsSync(migrationPath)) return [];
  
  return fs.readdirSync(migrationPath)
    .filter(f => f.includes(scope) || f.includes(scope.replace('-', '_')))
    .map(f => path.join(migrationPath, f))
    .sort(); // Chronological order
}

/**
 * Parse contract file to extract definition
 */
function parseContract(filePath: string): ContractDefinition | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath, '.ts');
    
    // Extract interface/type fields (simple regex, not full AST)
    const interfaceMatch = content.match(/export\s+(?:interface|type)\s+(\w+)\s*{([^}]+)}/s);
    if (!interfaceMatch) return null;
    
    const name = interfaceMatch[1];
    const body = interfaceMatch[2];
    
    // Extract field names
    const fields = Array.from(body.matchAll(/^\s*(\w+)[?:]?\s*:/gm))
      .map(m => m[1])
      .filter(f => f !== 'id' && f !== 'created_at' && f !== 'updated_at'); // Filter common fields
    
    // Extract enums if present
    const enums: Record<string, string[]> = {};
    const enumMatches = content.matchAll(/export\s+enum\s+(\w+)\s*{([^}]+)}/gs);
    for (const match of enumMatches) {
      const enumName = match[1];
      const enumBody = match[2];
      const values = Array.from(enumBody.matchAll(/(\w+)\s*=/g))
        .map(m => m[1]);
      if (values.length > 0) {
        enums[enumName] = values;
      }
    }
    
    // Extract states if present (common pattern: status field with union type)
    let states: string[] | undefined;
    const stateMatch = body.match(/status[?:]?\s*:\s*['"]([^'"]+)['"]\s*\|/);
    if (stateMatch) {
      const stateString = body.match(/status[?:]?\s*:\s*([^;]+);/)?.[1] || '';
      states = Array.from(stateString.matchAll(/['"](\w+)['"]/g))
        .map(m => m[1]);
    }
    
    return {
      name,
      path: filePath,
      fields,
      enums: Object.keys(enums).length > 0 ? enums : undefined,
      states
    };
  } catch (error) {
    console.error(`Error parsing contract ${filePath}:`, error);
    return null;
  }
}

/**
 * Parse migration file to extract schema definition
 */
function parseSchema(filePath: string, tableName: string): SchemaDefinition | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Find CREATE TABLE for this table
    const tableRegex = new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${tableName}\\s*\\(([^;]+)\\);`, 'is');
    const tableMatch = content.match(tableRegex);
    if (!tableMatch) return null;
    
    const tableBody = tableMatch[1];
    
    // Extract column names
    const columns = Array.from(tableBody.matchAll(/^\s*(\w+)\s+(?:uuid|text|integer|bigint|boolean|timestamp|jsonb|numeric)/gim))
      .map(m => m[1])
      .filter(c => c !== 'id' && c !== 'created_at' && c !== 'updated_at');
    
    // Extract enums referenced by table
    const enums: Record<string, string[]> = {};
    const enumTypeMatches = tableBody.matchAll(/(\w+)\s+(\w+_(?:status|state|type))/gi);
    for (const match of enumTypeMatches) {
      const enumType = match[2];
      // Find enum definition
      const enumDefRegex = new RegExp(`CREATE\\s+TYPE\\s+${enumType}\\s+AS\\s+ENUM\\s*\\(([^)]+)\\)`, 'i');
      const enumDefMatch = content.match(enumDefRegex);
      if (enumDefMatch) {
        const values = Array.from(enumDefMatch[1].matchAll(/['"](\w+)['"]/g))
          .map(m => m[1]);
        if (values.length > 0) {
          enums[enumType] = values;
        }
      }
    }
    
    return {
      table: tableName,
      path: filePath,
      columns,
      enums: Object.keys(enums).length > 0 ? enums : undefined
    };
  } catch (error) {
    console.error(`Error parsing schema ${filePath}:`, error);
    return null;
  }
}

/**
 * Parse generated database types to check consistency
 */
function parseGeneratedTypes(tableName: string): string[] | null {
  const typesPath = path.join(process.cwd(), 'src', 'platform', 'core', 'database.types.ts');
  if (!fs.existsSync(typesPath)) return null;
  
  try {
    const content = fs.readFileSync(typesPath, 'utf-8');
    
    // Find table definition in Tables interface
    const tableRegex = new RegExp(`${tableName}:\\s*{[^}]*Row:\\s*{([^}]+)}`, 's');
    const match = content.match(tableRegex);
    if (!match) return null;
    
    const rowBody = match[1];
    const fields = Array.from(rowBody.matchAll(/(\w+)[?:]?\s*:/g))
      .map(m => m[1])
      .filter(f => f !== 'id' && f !== 'created_at' && f !== 'updated_at');
    
    return fields;
  } catch (error) {
    console.error(`Error parsing generated types:`, error);
    return null;
  }
}

// ============================================================================
// Core Checks
// ============================================================================

/**
 * Check 1: Contract existence and ownership
 */
function checkContractExistence(scope: string): CheckResult {
  const contractFiles = findContractFiles(scope);
  
  if (contractFiles.length === 0) {
    return {
      check: 'Contract existence',
      verdict: 'FAIL',
      blockers: [`No contract files found in src/platform/${scope}/contracts/`]
    };
  }
  
  const contracts = contractFiles
    .map(f => parseContract(f))
    .filter((c): c is ContractDefinition => c !== null);
  
  if (contracts.length === 0) {
    return {
      check: 'Contract existence',
      verdict: 'FAIL',
      blockers: ['Contract files exist but could not parse definitions']
    };
  }
  
  return {
    check: 'Contract existence',
    verdict: 'PASS',
    details: [`Found ${contracts.length} contract(s): ${contracts.map(c => c.name).join(', ')}`]
  };
}

/**
 * Check 2: Schema field presence
 */
function checkSchemaFields(contract: ContractDefinition, schema: SchemaDefinition): CheckResult {
  const missingInSchema = contract.fields.filter(f => !schema.columns.includes(f));
  const missingInContract = schema.columns.filter(c => !contract.fields.includes(c));
  
  if (missingInSchema.length === 0 && missingInContract.length === 0) {
    return {
      check: 'Schema field presence',
      verdict: 'PASS',
      details: [`All ${contract.fields.length} contract fields present in schema`]
    };
  }
  
  const blockers: string[] = [];
  if (missingInSchema.length > 0) {
    blockers.push(`Contract fields missing in schema: ${missingInSchema.join(', ')}`);
  }
  if (missingInContract.length > 0) {
    blockers.push(`Schema columns missing in contract: ${missingInContract.join(', ')}`);
  }
  
  return {
    check: 'Schema field presence',
    verdict: 'FAIL',
    blockers
  };
}

/**
 * Check 3: Enum / state vocabulary
 */
function checkEnumVocabulary(contract: ContractDefinition, schema: SchemaDefinition): CheckResult {
  // Check if contract has states
  if (!contract.states || contract.states.length === 0) {
    return {
      check: 'Enum/state vocabulary',
      verdict: 'PASS',
      details: ['No state vocabulary to validate']
    };
  }
  
  // Check if schema has corresponding enum
  if (!schema.enums || Object.keys(schema.enums).length === 0) {
    return {
      check: 'Enum/state vocabulary',
      verdict: 'FAIL',
      blockers: ['Contract defines states but schema has no enum']
    };
  }
  
  // Compare vocabularies
  const schemaEnumValues = Object.values(schema.enums)[0]; // Assume first enum is status
  const contractStates = contract.states;
  
  // Check for exact match
  const matchesExactly = 
    contractStates.length === schemaEnumValues.length &&
    contractStates.every(s => schemaEnumValues.includes(s));
  
  if (matchesExactly) {
    return {
      check: 'Enum/state vocabulary',
      verdict: 'PASS',
      details: [`Contract states match schema enum: ${contractStates.join(', ')}`]
    };
  }
  
  // Check if vocabularies differ
  const inContractNotSchema = contractStates.filter(s => !schemaEnumValues.includes(s));
  const inSchemaNotContract = schemaEnumValues.filter(s => !contractStates.includes(s));
  
  if (inContractNotSchema.length > 0 || inSchemaNotContract.length > 0) {
    return {
      check: 'Enum/state vocabulary',
      verdict: 'REVIEW_REQUIRED',
      blockers: [
        `Domain vocabulary differs from DB enum`,
        `Contract: ${contractStates.join(', ')}`,
        `Schema: ${schemaEnumValues.join(', ')}`,
        `Semantic mapping cannot be inferred automatically`
      ]
    };
  }
  
  return {
    check: 'Enum/state vocabulary',
    verdict: 'PASS'
  };
}

/**
 * Check 4: Generated DB type consistency
 */
function checkGeneratedTypes(contract: ContractDefinition, tableName: string): CheckResult {
  const generatedFields = parseGeneratedTypes(tableName);
  
  if (!generatedFields) {
    return {
      check: 'Generated type consistency',
      verdict: 'FAIL',
      blockers: [`Could not find generated types for table '${tableName}' in database.types.ts`]
    };
  }
  
  const missingInGenerated = contract.fields.filter(f => !generatedFields.includes(f));
  const extraInGenerated = generatedFields.filter(f => !contract.fields.includes(f));
  
  if (missingInGenerated.length === 0 && extraInGenerated.length === 0) {
    return {
      check: 'Generated type consistency',
      verdict: 'PASS',
      details: ['Generated types match contract definition']
    };
  }
  
  const blockers: string[] = [];
  if (missingInGenerated.length > 0) {
    blockers.push(`Contract fields missing in generated types: ${missingInGenerated.join(', ')}`);
  }
  if (extraInGenerated.length > 0) {
    blockers.push(`Generated types have extra fields: ${extraInGenerated.join(', ')}`);
  }
  blockers.push('Run: npm run supabase:generate-types');
  
  return {
    check: 'Generated type consistency',
    verdict: 'FAIL',
    blockers
  };
}

// ============================================================================
// Gate Execution
// ============================================================================

/**
 * Run gate for a specific scope
 */
function runGate(scope: string, tableName: string): GateResult {
  const checks: CheckResult[] = [];
  
  // Check 1: Contract existence
  const contractCheck = checkContractExistence(scope);
  checks.push(contractCheck);
  
  if (contractCheck.verdict === 'FAIL') {
    return {
      verdict: 'FAIL',
      checks,
      summary: ['Cannot proceed without contract definition']
    };
  }
  
  // Get contract and schema
  const contractFiles = findContractFiles(scope);
  const contract = contractFiles
    .map(f => parseContract(f))
    .filter((c): c is ContractDefinition => c !== null)[0];
  
  const migrationFiles = findMigrationFiles(scope);
  const schema = migrationFiles
    .map(f => parseSchema(f, tableName))
    .filter((s): s is SchemaDefinition => s !== null)
    .pop(); // Use latest migration
  
  if (!schema) {
    checks.push({
      check: 'Schema discovery',
      verdict: 'FAIL',
      blockers: [`Could not find schema definition for table '${tableName}'`]
    });
    return {
      verdict: 'FAIL',
      checks,
      summary: ['Schema not found in migrations']
    };
  }
  
  // Check 2: Schema fields
  checks.push(checkSchemaFields(contract, schema));
  
  // Check 3: Enum vocabulary
  checks.push(checkEnumVocabulary(contract, schema));
  
  // Check 4: Generated types
  checks.push(checkGeneratedTypes(contract, tableName));
  
  // Determine overall verdict
  const hasFailures = checks.some(c => c.verdict === 'FAIL');
  const hasReviewRequired = checks.some(c => c.verdict === 'REVIEW_REQUIRED');
  
  let verdict: Verdict = 'PASS';
  const summary: string[] = [];
  
  if (hasFailures) {
    verdict = 'FAIL';
    summary.push('Objective mismatches detected');
    summary.push('Fix required before implementation can proceed');
  } else if (hasReviewRequired) {
    verdict = 'REVIEW_REQUIRED';
    summary.push('Semantic mismatch detected');
    summary.push('Architectural decision required');
    summary.push('AI cannot auto-decide semantic mapping');
  } else {
    summary.push('Contract and Schema conform');
  }
  
  return { verdict, checks, summary };
}

// ============================================================================
// CLI
// ============================================================================

function printResults(scope: string, tableName: string, result: GateResult): void {
  console.log('\n' + '='.repeat(60));
  console.log('CONTRACT–SCHEMA CONFORMANCE GATE');
  console.log('='.repeat(60));
  console.log(`Scope: ${scope}`);
  console.log(`Table: ${tableName}`);
  console.log('='.repeat(60) + '\n');
  
  // Print checks
  for (const check of result.checks) {
    const icon = check.verdict === 'PASS' ? '✅' : check.verdict === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${check.verdict.padEnd(16)} ${check.check}`);
    
    if (check.details) {
      for (const detail of check.details) {
        console.log(`   ${detail}`);
      }
    }
    
    if (check.blockers) {
      for (const blocker of check.blockers) {
        console.log(`   🔴 ${blocker}`);
      }
    }
    console.log();
  }
  
  // Print verdict
  console.log('='.repeat(60));
  const verdictIcon = result.verdict === 'PASS' ? '✅' : result.verdict === 'FAIL' ? '❌' : '⚠️';
  console.log(`${verdictIcon} VERDICT: ${result.verdict}`);
  console.log('='.repeat(60));
  
  if (result.summary.length > 0) {
    console.log();
    for (const line of result.summary) {
      console.log(line);
    }
  }
  
  console.log();
}

function main(): void {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: npm run governance:contract-schema <scope> <table-name>');
    console.error('Example: npm run governance:contract-schema real-estate re_products');
    process.exit(1);
  }
  
  const [scope, tableName] = args;
  
  const result = runGate(scope, tableName);
  printResults(scope, tableName, result);
  
  // Exit code based on verdict
  if (result.verdict === 'FAIL') {
    process.exit(1);
  } else if (result.verdict === 'REVIEW_REQUIRED') {
    process.exit(2);
  }
  // PASS = exit 0
}

if (require.main === module) {
  main();
}

export { runGate, GateResult, CheckResult, Verdict };
