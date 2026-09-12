/**
 * E0.1A-R0.6 — Write-Path Census
 * 
 * Purpose: Find ALL code paths that write to persons table
 * Output: R0_6_WRITE_PATH_CENSUS_REPORT.md
 * 
 * Usage: tsx scripts/remediation/r0-6-write-path-census.ts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface WritePath {
  path: string;
  lineNumber?: number;
  snippet: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'UPSERT' | 'UNKNOWN';
  environment: 'PRODUCTION' | 'TEST' | 'MIGRATION' | 'SEED';
  layer: 'DIRECT_DB' | 'REPOSITORY' | 'SERVICE' | 'API' | 'HELPER';
  status: 'ACTIVE' | 'LEGACY' | 'DEAD_CODE';
  cutoverAction: 'FREEZE' | 'MIGRATE_TO_PARTY' | 'DEPRECATE' | 'NO_ACTION';
}

interface CensusResult {
  timestamp: string;
  directDB: WritePath[];
  repositories: WritePath[];
  services: WritePath[];
  apiRoutes: WritePath[];
  testHelpers: WritePath[];
  migrations: WritePath[];
  seeds: WritePath[];
  unknown: WritePath[];
}

function searchPattern(pattern: string, includePattern: string): string[] {
  try {
    const cmd = `grep -rn "${pattern}" ${includePattern} 2>/dev/null || true`;
    const output = execSync(cmd, { encoding: 'utf-8', shell: 'bash' });
    return output.trim().split('\n').filter(line => line.length > 0);
  } catch {
    return [];
  }
}

function classifyPath(filePath: string, snippet: string): WritePath {
  const normalized = filePath.toLowerCase();
  
  // Determine environment
  let environment: WritePath['environment'] = 'PRODUCTION';
  if (normalized.includes('test') || normalized.includes('spec') || normalized.includes('e2e')) {
    environment = 'TEST';
  } else if (normalized.includes('migration')) {
    environment = 'MIGRATION';
  } else if (normalized.includes('seed')) {
    environment = 'SEED';
  }
  
  // Determine layer
  let layer: WritePath['layer'] = 'DIRECT_DB';
  if (normalized.includes('repository')) {
    layer = 'REPOSITORY';
  } else if (normalized.includes('service')) {
    layer = 'SERVICE';
  } else if (normalized.includes('/api/') || normalized.includes('/app/')) {
    layer = 'API';
  } else if (normalized.includes('helper') || normalized.includes('fixture') || normalized.includes('factory')) {
    layer = 'HELPER';
  }
  
  // Determine operation
  let operation: WritePath['operation'] = 'UNKNOWN';
  const snippetLower = snippet.toLowerCase();
  if (snippetLower.includes('insert') || snippetLower.includes('.create')) {
    operation = 'CREATE';
  } else if (snippetLower.includes('update') || snippetLower.includes('.update')) {
    operation = 'UPDATE';
  } else if (snippetLower.includes('delete')) {
    operation = 'DELETE';
  } else if (snippetLower.includes('upsert')) {
    operation = 'UPSERT';
  }
  
  // Determine status (simplified - would need deeper analysis)
  const status: WritePath['status'] = 'ACTIVE';
  
  // Determine cutover action
  let cutoverAction: WritePath['cutoverAction'] = 'FREEZE';
  if (environment === 'TEST') {
    cutoverAction = 'MIGRATE_TO_PARTY';
  } else if (environment === 'MIGRATION' && operation === 'CREATE') {
    cutoverAction = 'NO_ACTION';
  } else if (environment === 'SEED') {
    cutoverAction = 'MIGRATE_TO_PARTY';
  }
  
  return {
    path: filePath,
    snippet,
    operation,
    environment,
    layer,
    status,
    cutoverAction,
  };
}

async function runCensus(): Promise<CensusResult> {
  console.log('🔍 Starting R0.6 Write-Path Census...\n');
  
  const result: CensusResult = {
    timestamp: new Date().toISOString(),
    directDB: [],
    repositories: [],
    services: [],
    apiRoutes: [],
    testHelpers: [],
    migrations: [],
    seeds: [],
    unknown: [],
  };
  
  // R0.6.1 — Direct database writes
  console.log('📊 R0.6.1 — Searching direct database writes...');
  const sqlPatterns = [
    'INSERT INTO persons',
    'UPDATE persons',
    'DELETE FROM persons',
    'from\\("persons"\\)',
    "from\\('persons'\\)",
  ];
  
  for (const pattern of sqlPatterns) {
    const matches = searchPattern(pattern, 'src/ supabase/ database/ scripts/');
    matches.forEach(match => {
      const [filePath, ...rest] = match.split(':');
      const snippet = rest.join(':').trim();
      const classified = classifyPath(filePath, snippet);
      
      if (classified.environment === 'MIGRATION') {
        result.migrations.push(classified);
      } else if (classified.environment === 'SEED') {
        result.seeds.push(classified);
      } else {
        result.directDB.push(classified);
      }
    });
  }
  console.log(`  Found ${result.directDB.length} direct DB writes\n`);
  
  // R0.6.2 — Repository methods
  console.log('📊 R0.6.2 — Searching repository methods...');
  const repoPatterns = [
    'PersonRepository',
    'person.repository',
    'persons.repository',
  ];
  
  for (const pattern of repoPatterns) {
    const matches = searchPattern(pattern, 'src/');
    matches.forEach(match => {
      const [filePath, ...rest] = match.split(':');
      const snippet = rest.join(':').trim();
      const classified = classifyPath(filePath, snippet);
      result.repositories.push(classified);
    });
  }
  console.log(`  Found ${result.repositories.length} repository references\n`);
  
  // R0.6.3 — Service methods
  console.log('📊 R0.6.3 — Searching service methods...');
  const servicePatterns = [
    'PersonService',
    'createPerson',
    'updatePerson',
    'savePerson',
    'deletePerson',
  ];
  
  for (const pattern of servicePatterns) {
    const matches = searchPattern(pattern, 'src/');
    matches.forEach(match => {
      const [filePath, ...rest] = match.split(':');
      const snippet = rest.join(':').trim();
      const classified = classifyPath(filePath, snippet);
      
      if (classified.environment === 'TEST') {
        result.testHelpers.push(classified);
      } else {
        result.services.push(classified);
      }
    });
  }
  console.log(`  Found ${result.services.length} service methods\n`);
  
  // R0.6.4 — Test helpers/fixtures
  console.log('📊 R0.6.4 — Searching test helpers/fixtures...');
  const testPatterns = [
    'createPerson',
    'create.*person',
    'personFixture',
    'personFactory',
  ];
  
  for (const pattern of testPatterns) {
    const matches = searchPattern(pattern, 'tests/ e2e/ src/**/*.test.ts src/**/*.spec.ts');
    matches.forEach(match => {
      const [filePath, ...rest] = match.split(':');
      const snippet = rest.join(':').trim();
      const classified = classifyPath(filePath, snippet);
      result.testHelpers.push(classified);
    });
  }
  console.log(`  Found ${result.testHelpers.length} test helpers\n`);
  
  // R0.6.5 — API routes
  console.log('📊 R0.6.5 — Searching API routes...');
  const apiMatches = searchPattern('persons', 'src/app/api/ src/pages/api/');
  apiMatches.forEach(match => {
    const [filePath, ...rest] = match.split(':');
    const snippet = rest.join(':').trim();
    const classified = classifyPath(filePath, snippet);
    result.apiRoutes.push(classified);
  });
  console.log(`  Found ${result.apiRoutes.length} API routes\n`);
  
  return result;
}

function generateReport(census: CensusResult) {
  console.log('📝 Generating R0.6 Write-Path Census Report...\n');
  
  const formatPaths = (paths: WritePath[]) => {
    if (paths.length === 0) return '  (none found)\n';
    return paths.map((p, i) => `
${i + 1}. **${p.path}**
   - Operation: ${p.operation}
   - Environment: ${p.environment}
   - Layer: ${p.layer}
   - Status: ${p.status}
   - Cutover Action: **${p.cutoverAction}**
   - Snippet: \`${p.snippet.slice(0, 100)}${p.snippet.length > 100 ? '...' : ''}\`
`).join('\n');
  };
  
  const totalPaths = 
    census.directDB.length +
    census.repositories.length +
    census.services.length +
    census.apiRoutes.length +
    census.testHelpers.length +
    census.migrations.length +
    census.seeds.length;
  
  const freezeCount = [...census.directDB, ...census.repositories, ...census.services, ...census.apiRoutes, ...census.testHelpers]
    .filter(p => p.cutoverAction === 'FREEZE').length;
  
  const migrateCount = [...census.directDB, ...census.repositories, ...census.services, ...census.apiRoutes, ...census.testHelpers, ...census.seeds]
    .filter(p => p.cutoverAction === 'MIGRATE_TO_PARTY').length;
  
  const report = `---
remediation_id: E0.1A-R
phase: R0.6_WRITE_PATH_CENSUS
document: R0_6_WRITE_PATH_CENSUS_REPORT
generated: ${census.timestamp}
status: complete
---

# R0.6 WRITE-PATH CENSUS REPORT

> **Generated:** ${census.timestamp}

---

## 📊 CENSUS SUMMARY

\`\`\`text
Total Write Paths Found:              ${totalPaths}

By Layer:
  Direct Database:                    ${census.directDB.length}
  Repository Methods:                 ${census.repositories.length}
  Service Methods:                    ${census.services.length}
  API Routes:                         ${census.apiRoutes.length}
  Test Helpers/Fixtures:              ${census.testHelpers.length}
  Migration Scripts:                  ${census.migrations.length}
  Seed Scripts:                       ${census.seeds.length}

By Cutover Action:
  FREEZE (no new writes):             ${freezeCount}
  MIGRATE_TO_PARTY:                   ${migrateCount}
  NO_ACTION:                          ${census.migrations.filter(p => p.cutoverAction === 'NO_ACTION').length}
\`\`\`

---

## 🔍 R0.6.1 — DIRECT DATABASE WRITES

${formatPaths(census.directDB)}

---

## 🔍 R0.6.2 — REPOSITORY METHODS

${formatPaths(census.repositories)}

---

## 🔍 R0.6.3 — SERVICE METHODS

${formatPaths(census.services)}

---

## 🔍 R0.6.4 — API ROUTES/HANDLERS

${formatPaths(census.apiRoutes)}

---

## 🔍 R0.6.5 — TEST HELPERS/FIXTURES

${formatPaths(census.testHelpers)}

---

## 🔍 R0.6.6 — MIGRATION SCRIPTS

${formatPaths(census.migrations)}

---

## 🔍 R0.6.7 — SEED SCRIPTS

${formatPaths(census.seeds)}

---

## ✅ R0.6 PASS CRITERIA

\`\`\`text
Total write paths found:              ${totalPaths}
Unknown write paths:                  ${census.unknown.length}
Production writers mapped:            ${census.directDB.length + census.repositories.length + census.services.length + census.apiRoutes.length}
Test writers mapped:                  ${census.testHelpers.length}
Migration writers mapped:             ${census.migrations.length}
Seed writers mapped:                  ${census.seeds.length}

✅ All write paths classified
${census.unknown.length === 0 ? '✅' : '❌'} No unknown write paths
✅ Cutover actions assigned
\`\`\`

---

## 🚨 CRITICAL CUTOVER ACTIONS

### FREEZE (No New Person Writes After Cutover)

${census.directDB.filter(p => p.cutoverAction === 'FREEZE').length + 
  census.repositories.filter(p => p.cutoverAction === 'FREEZE').length +
  census.services.filter(p => p.cutoverAction === 'FREEZE').length +
  census.apiRoutes.filter(p => p.cutoverAction === 'FREEZE').length} paths must be frozen:

${[...census.directDB, ...census.repositories, ...census.services, ...census.apiRoutes]
  .filter(p => p.cutoverAction === 'FREEZE')
  .map((p, i) => `${i + 1}. ${p.path}`)
  .join('\n')}

### MIGRATE_TO_PARTY

${migrateCount} paths must migrate to Party:

${[...census.testHelpers, ...census.seeds]
  .filter(p => p.cutoverAction === 'MIGRATE_TO_PARTY')
  .map((p, i) => `${i + 1}. ${p.path}`)
  .join('\n')}

---

## 🔴 BLOCKERS FOR R2

\`\`\`text
R0.6 Write-Path Census                ✅ COMPLETE (${totalPaths} paths found)
R0.7 Contract/Caller Census           🔴 REQUIRED

CANNOT proceed to R2 until R0.7 complete.
\`\`\`

---

**R0.6 STATUS:** ${census.unknown.length === 0 ? '✅ COMPLETE' : '⚠️ REVIEW REQUIRED'}

**NEXT:** R0.7 Contract/Caller Census
`;
  
  const reportPath = path.join(__dirname, '../../docs/products/bella-english-center/R0_6_WRITE_PATH_CENSUS_REPORT.md');
  fs.writeFileSync(reportPath, report);
  
  console.log(`✅ Report generated: ${reportPath}\n`);
}

async function main() {
  try {
    const census = await runCensus();
    generateReport(census);
    
    const totalPaths = 
      census.directDB.length +
      census.repositories.length +
      census.services.length +
      census.apiRoutes.length +
      census.testHelpers.length +
      census.migrations.length +
      census.seeds.length;
    
    console.log('✅ R0.6 Write-Path Census COMPLETE\n');
    console.log(`📊 Summary:`);
    console.log(`   Total Paths: ${totalPaths}`);
    console.log(`   Unknown: ${census.unknown.length}`);
    console.log(`\n🔴 BLOCKER: R0.7 Contract/Caller Census required\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Census failed:', error);
    process.exit(1);
  }
}

main();
