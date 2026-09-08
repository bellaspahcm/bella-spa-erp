#!/usr/bin/env tsx
/**
 * Construction Context Assembly
 * 
 * Purpose: Transform Factory evidence + scope decisions into structured context
 *          that enables AI coding agents to autonomously construct Industry OS
 * 
 * Input: Evidence Map + Scope Derivation Results
 * Output: Context documents per RECONSTRUCT entity
 * 
 * Evidence: Retail Run #2 validated that assembled context materially improves
 *           autonomous construction (5/5 entities vs 2/5 baseline)
 */

import type { CanonicalEvidence, ScopeDerivationResult } from './canonical-scope-derivation';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export interface ConstructionContext {
  entity: string;
  decision: string;
  canonicalSchema: string;
  referencePattern?: {
    path: string;
    similarity: string;
    reason: string;
  };
  expectedOutput: {
    domainPath: string;
    testPath: string;
  };
  structureRequirements: string[];
  verificationCommands: string[];
  successCriteria: string[];
}

interface PatternMatch {
  path: string;
  score: number;
  reason: string;
}

/**
 * Assemble construction context for RECONSTRUCT entities
 */
export function assembleConstructionContext(
  entityName: string,
  scopeResult: ScopeDerivationResult,
  industryScope: string,
  options: {
    migrationsPath?: string;
    domainBasePath?: string;
    testBasePath?: string;
  } = {}
): ConstructionContext | null {
  // Only assemble for RECONSTRUCT decisions
  if (scopeResult.decision !== 'RECONSTRUCT') {
    return null;
  }

  const migrationsPath = options.migrationsPath || 'supabase/migrations';
  const domainBasePath = options.domainBasePath || `src/platform/${industryScope}`;
  const testBasePath = options.testBasePath || `tests/platform/${industryScope}`;

  // Extract canonical schema
  const canonicalSchema = extractCanonicalSchema(
    entityName,
    industryScope,
    migrationsPath
  );

  // Find reference pattern
  const referencePattern = findReferencePattern(
    entityName,
    scopeResult.evidence
  );

  // Determine entity name format
  const entityFileName = toKebabCase(entityName);

  return {
    entity: entityName,
    decision: scopeResult.decision,
    canonicalSchema,
    referencePattern,
    expectedOutput: {
      domainPath: `${domainBasePath}/domain/${entityFileName}.ts`,
      testPath: `${testBasePath}/${entityFileName}.test.ts`,
    },
    structureRequirements: [
      'Entity interface mapping canonical table columns',
      'Create command with validation',
      'Update methods with business rule enforcement',
      'Status transitions if applicable',
      'Persistence round-trip (fromPersistence/toPersistence)',
      'Getters for all properties',
    ],
    verificationCommands: [
      `npx vitest run ${testBasePath}/${entityFileName}.test.ts`,
      'npx tsc --noEmit',
      'npm run arch:guard',
    ],
    successCriteria: [
      'All tests PASS',
      'TypeScript 0 errors',
      'Architecture Guard PASS',
      'Business rules from schema implemented',
      'Validation prevents invalid states',
    ],
  };
}

/**
 * Extract canonical schema DDL for entity
 */
function extractCanonicalSchema(
  entityName: string,
  industryScope: string,
  migrationsPath: string
): string {
  if (!existsSync(migrationsPath)) {
    return `# Schema not found for ${entityName}`;
  }

  // Convert entity name to table name format
  const tableName = toTableName(entityName, industryScope);

  // Search migrations for CREATE TABLE statement
  const migrationFiles = readdirSync(migrationsPath)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .reverse(); // Most recent first

  for (const file of migrationFiles) {
    const content = readFileSync(join(migrationsPath, file), 'utf-8');

    // Find CREATE TABLE block
    const tableRegex = new RegExp(
      `CREATE\\s+TABLE[^;]*${tableName}[^;]*\\([^)]+\\)[^;]*;`,
      'is'
    );

    const match = content.match(tableRegex);
    if (match) {
      return match[0].trim();
    }
  }

  return `# No canonical schema found for ${tableName}`;
}

/**
 * Find most similar existing domain pattern as reference
 */
function findReferencePattern(
  entityName: string,
  evidence: CanonicalEvidence
): ConstructionContext['referencePattern'] | undefined {
  const platformPath = 'src/platform';

  if (!existsSync(platformPath)) {
    return undefined;
  }

  const patterns: PatternMatch[] = [];

  // Scan platform directories for domain patterns
  const industries = readdirSync(platformPath, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const industry of industries) {
    const domainPath = join(platformPath, industry, 'domain');

    if (!existsSync(domainPath)) {
      continue;
    }

    const domainFiles = readdirSync(domainPath)
      .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));

    for (const file of domainFiles) {
      const fullPath = join(domainPath, file);
      const content = readFileSync(fullPath, 'utf-8');

      // Score similarity based on patterns
      const score = scoreSimilarity(content, evidence);

      if (score > 0) {
        patterns.push({
          path: fullPath,
          score,
          reason: explainSimilarity(content, evidence),
        });
      }
    }
  }

  // Return highest scoring pattern
  if (patterns.length === 0) {
    return undefined;
  }

  patterns.sort((a, b) => b.score - a.score);
  const best = patterns[0];

  return {
    path: best.path,
    similarity: `${Math.round(best.score * 100)}% similar`,
    reason: best.reason,
  };
}

/**
 * Score similarity between potential pattern and target entity
 */
function scoreSimilarity(content: string, evidence: CanonicalEvidence): number {
  let score = 0;

  // Has similar structure markers
  if (content.includes('interface') && content.includes('Props')) score += 0.2;
  if (content.includes('create(') && content.includes('Command')) score += 0.2;
  if (content.includes('fromPersistence') && content.includes('toPersistence')) score += 0.3;
  if (content.includes('update(')) score += 0.1;
  if (content.includes('get ')) score += 0.1; // Getters

  // Has validation patterns
  if (content.includes('throw new Error')) score += 0.1;

  return Math.min(score, 1.0);
}

/**
 * Explain why pattern is similar
 */
function explainSimilarity(content: string, evidence: CanonicalEvidence): string {
  const reasons: string[] = [];

  if (content.includes('create(') && content.includes('Command')) {
    reasons.push('Has create command pattern');
  }

  if (content.includes('fromPersistence') && content.includes('toPersistence')) {
    reasons.push('Has persistence round-trip');
  }

  if (content.includes('update(')) {
    reasons.push('Has update operations');
  }

  if (content.includes('status')) {
    reasons.push('Has status field (common pattern)');
  }

  return reasons.join(', ') || 'Similar domain entity structure';
}

/**
 * Convert entity name to table name
 * Example: Product → retail_products, SaleItem → retail_sale_items
 */
function toTableName(entityName: string, industryScope: string): string {
  // Convert PascalCase to snake_case
  const snakeCase = entityName
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');

  // Pluralize (simple rules)
  let plural = snakeCase;
  if (snakeCase.endsWith('y')) {
    plural = snakeCase.slice(0, -1) + 'ies';
  } else if (!snakeCase.endsWith('s')) {
    plural = snakeCase + 's';
  }

  return `${industryScope}_${plural}`;
}

/**
 * Convert entity name to kebab-case filename
 * Example: SaleItem → sale-item
 */
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Generate markdown context document for an entity
 */
export function generateContextDocument(context: ConstructionContext): string {
  const lines: string[] = [];

  lines.push(`# RECONSTRUCT: ${context.entity}`);
  lines.push('');
  lines.push('## Canonical Schema');
  lines.push('');
  lines.push('```sql');
  lines.push(context.canonicalSchema);
  lines.push('```');
  lines.push('');

  if (context.referencePattern) {
    lines.push('## Reference Implementation');
    lines.push('');
    lines.push(`**Path:** \`${context.referencePattern.path}\``);
    lines.push(`**Similarity:** ${context.referencePattern.similarity}`);
    lines.push(`**Reason:** ${context.referencePattern.reason}`);
    lines.push('');
    lines.push('Study this implementation for:');
    lines.push('- Entity structure and interface design');
    lines.push('- Create/update command patterns');
    lines.push('- Validation logic placement');
    lines.push('- Persistence mapping (fromPersistence/toPersistence)');
    lines.push('- Getter patterns');
    lines.push('');
  }

  lines.push('## Expected Output');
  lines.push('');
  lines.push(`- **Domain:** \`${context.expectedOutput.domainPath}\``);
  lines.push(`- **Tests:** \`${context.expectedOutput.testPath}\``);
  lines.push('');

  lines.push('## Structure Requirements');
  lines.push('');
  for (const req of context.structureRequirements) {
    lines.push(`- ${req}`);
  }
  lines.push('');

  lines.push('## Verification');
  lines.push('');
  lines.push('Run these commands to verify implementation:');
  lines.push('');
  lines.push('```bash');
  for (const cmd of context.verificationCommands) {
    lines.push(cmd);
  }
  lines.push('```');
  lines.push('');

  lines.push('## Success Criteria');
  lines.push('');
  for (const criterion of context.successCriteria) {
    lines.push(`- ${criterion}`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Assemble contexts for all RECONSTRUCT entities
 */
export function assembleAllConstructionContexts(
  evidenceMap: Map<string, { evidence: CanonicalEvidence; decision: ScopeDerivationResult }>,
  industryScope: string,
  options: Parameters<typeof assembleConstructionContext>[2] = {}
): Map<string, ConstructionContext> {
  const contexts = new Map<string, ConstructionContext>();

  for (const [entityName, { decision: scopeResult }] of evidenceMap.entries()) {
    const context = assembleConstructionContext(entityName, scopeResult, industryScope, options);

    if (context) {
      contexts.set(entityName, context);
    }
  }

  return contexts;
}
