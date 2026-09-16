#!/usr/bin/env ts-node
/**
 * P0 Phase M1: Migration Census
 * 
 * Purpose: Classify all 458 migrations before deciding repair strategy.
 * 
 * Output: Comprehensive classification matrix for evidence-based decision.
 * 
 * Usage:
 *   npm run census:migrations
 *   # or
 *   ts-node scripts/census-migrations.ts
 * 
 * Part of: Bella Platform Hardening Initiative
 * Workstream: P0 - Migration Reproducibility
 * Phase: M1 - Census (READ ONLY)
 */

import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');

interface MigrationInfo {
  file: string;
  timestamp: string;
  name: string;
  ownership: string;
  actions: string[];
  objects: string[];
  status: 'Active' | 'Historical' | 'Orphaned' | 'Unknown';
  dependencies: string[];
  risk: 'Critical' | 'High' | 'Medium' | 'Low';
  cleanBuildBlocker: boolean;
}

/**
 * Parse migration file to extract metadata
 */
function parseMigration(filePath: string): MigrationInfo {
  const fileName = path.basename(filePath);
  const match = fileName.match(/^(\d{14})_(.+)\.sql$/);
  
  if (!match) {
    throw new Error(`Invalid migration filename: ${fileName}`);
  }

  const [, timestamp, name] = match;
  const content = fs.readFileSync(filePath, 'utf-8');

  return {
    file: fileName,
    timestamp,
    name,
    ownership: inferOwnership(name, content),
    actions: extractActions(content),
    objects: extractObjects(content),
    status: 'Unknown', // Will be classified later
    dependencies: extractDependencies(content),
    risk: 'Medium', // Will be classified later
    cleanBuildBlocker: false, // Will be determined by analysis
  };
}

/**
 * Infer ownership from migration name and content
 */
function inferOwnership(name: string, content: string): string {
  const nameLower = name.toLowerCase();
  const contentLower = content.toLowerCase();

  // Platform/Core patterns
  if (nameLower.includes('tenant') || nameLower.includes('user') || nameLower.includes('permission')) {
    return 'Platform/Core';
  }

  // Healthcare OS
  if (nameLower.includes('hc_') || nameLower.includes('healthcare') || 
      nameLower.includes('patient') || nameLower.includes('doctor') ||
      nameLower.includes('clinical') || nameLower.includes('encounter')) {
    return 'Healthcare OS';
  }

  // Logistics OS
  if (nameLower.includes('inventory') || nameLower.includes('movement') ||
      nameLower.includes('warehouse') || nameLower.includes('stock')) {
    return 'Logistics OS';
  }

  // Education OS
  if (nameLower.includes('edu_') || nameLower.includes('education') ||
      nameLower.includes('course') || nameLower.includes('student') ||
      nameLower.includes('meal') || nameLower.includes('allergen')) {
    return 'Education OS';
  }

  // Beauty OS
  if (nameLower.includes('beauty') || nameLower.includes('nail') ||
      nameLower.includes('haircut') || nameLower.includes('spa')) {
    return 'Beauty OS';
  }

  // Real Estate
  if (nameLower.includes('real_estate') || nameLower.includes('property') ||
      nameLower.includes('unit') || nameLower.includes('contract')) {
    return 'Real Estate';
  }

  // Spa/BabyCare
  if (nameLower.includes('booking') || nameLower.includes('session') ||
      nameLower.includes('package') || nameLower.includes('customer')) {
    return 'Spa/BabyCare';
  }

  // Check content for ownership clues
  if (contentLower.includes('healthcare') || contentLower.includes('hc_')) {
    return 'Healthcare OS';
  }

  if (contentLower.includes('education') || contentLower.includes('edu_')) {
    return 'Education OS';
  }

  return 'Legacy/Unknown';
}

/**
 * Extract SQL actions (CREATE, ALTER, DROP, etc.)
 */
function extractActions(content: string): string[] {
  const actions = new Set<string>();
  const patterns = [
    /CREATE\s+TABLE/gi,
    /CREATE\s+INDEX/gi,
    /CREATE\s+FUNCTION/gi,
    /CREATE\s+VIEW/gi,
    /CREATE\s+TYPE/gi,
    /CREATE\s+EXTENSION/gi,
    /ALTER\s+TABLE/gi,
    /ALTER\s+FUNCTION/gi,
    /DROP\s+TABLE/gi,
    /DROP\s+INDEX/gi,
    /DROP\s+FUNCTION/gi,
    /INSERT\s+INTO/gi,
    /UPDATE\s+/gi,
    /DELETE\s+FROM/gi,
    /GRANT\s+/gi,
    /REVOKE\s+/gi,
    /ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi,
    /CREATE\s+POLICY/gi,
  ];

  patterns.forEach((pattern) => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach((match) => {
        actions.add(match.replace(/\s+/g, ' ').trim().toUpperCase());
      });
    }
  });

  return Array.from(actions);
}

/**
 * Extract database objects being modified
 */
function extractObjects(content: string): string[] {
  const objects = new Set<string>();

  // Table names after CREATE TABLE, ALTER TABLE, DROP TABLE
  const tablePatterns = [
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi,
    /ALTER\s+TABLE\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi,
    /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi,
  ];

  tablePatterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      objects.add(match[1]);
    }
  });

  return Array.from(objects);
}

/**
 * Extract dependencies (REFERENCES, FK constraints)
 */
function extractDependencies(content: string): string[] {
  const deps = new Set<string>();

  // REFERENCES foreign_table
  const refPattern = /REFERENCES\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi;
  let match;
  while ((match = refPattern.exec(content)) !== null) {
    deps.add(match[1]);
  }

  return Array.from(deps);
}

/**
 * Main census execution
 */
function main() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('P0 PHASE M1: MIGRATION CENSUS');
  console.log('════════════════════════════════════════════════════════════════\n');

  // Read all migration files
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Total migrations found: ${files.length}\n`);

  // Parse all migrations
  const migrations: MigrationInfo[] = [];
  
  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    try {
      const info = parseMigration(filePath);
      migrations.push(info);
    } catch (error) {
      console.error(`Error parsing ${file}:`, error);
    }
  }

  // Group by ownership
  console.log('════════════════════════════════════════════════════════════════');
  console.log('OWNERSHIP BREAKDOWN');
  console.log('════════════════════════════════════════════════════════════════\n');

  const ownershipGroups = migrations.reduce((acc, m) => {
    acc[m.ownership] = (acc[m.ownership] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(ownershipGroups)
    .sort(([, a], [, b]) => b - a)
    .forEach(([owner, count]) => {
      const pct = ((count / migrations.length) * 100).toFixed(1);
      console.log(`${owner.padEnd(25)} ${count.toString().padStart(4)} (${pct}%)`);
    });

  // Group by action types
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('ACTION TYPE BREAKDOWN');
  console.log('════════════════════════════════════════════════════════════════\n');

  const actionCounts = new Map<string, number>();
  migrations.forEach((m) => {
    m.actions.forEach((action) => {
      actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
    });
  });

  Array.from(actionCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .forEach(([action, count]) => {
      console.log(`${action.padEnd(25)} ${count.toString().padStart(4)}`);
    });

  // Most frequently modified objects
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('TOP 20 MODIFIED OBJECTS');
  console.log('════════════════════════════════════════════════════════════════\n');

  const objectCounts = new Map<string, number>();
  migrations.forEach((m) => {
    m.objects.forEach((obj) => {
      objectCounts.set(obj, (objectCounts.get(obj) || 0) + 1);
    });
  });

  Array.from(objectCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .forEach(([obj, count]) => {
      console.log(`${obj.padEnd(35)} ${count.toString().padStart(4)}`);
    });

  // Export detailed CSV
  const csvPath = path.join(process.cwd(), 'docs', 'platform', 'P0_M1_MIGRATION_CENSUS.csv');
  const csvHeaders = 'File,Timestamp,Name,Ownership,Actions,Objects,Dependencies\n';
  const csvRows = migrations.map((m) => {
    return [
      m.file,
      m.timestamp,
      `"${m.name}"`,
      m.ownership,
      `"${m.actions.join(', ')}"`,
      `"${m.objects.join(', ')}"`,
      `"${m.dependencies.join(', ')}"`,
    ].join(',');
  }).join('\n');

  fs.writeFileSync(csvPath, csvHeaders + csvRows, 'utf-8');

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('CENSUS COMPLETE');
  console.log('════════════════════════════════════════════════════════════════\n');
  console.log(`Detailed report exported: ${csvPath}`);
  console.log('\nNext steps:');
  console.log('1. Review census data in CSV');
  console.log('2. Classify migrations as Active/Historical/Orphaned/Unknown');
  console.log('3. Determine clean-build blockers');
  console.log('4. Decision gate: Selective repair / Baseline / Hybrid');
  console.log('\nSee: docs/platform/BELLA_PLATFORM_HARDENING.md (P0 Phase M2)');
}

// Run census if executed directly
main();

export { parseMigration, inferOwnership, extractActions, extractObjects, extractDependencies };
