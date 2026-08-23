#!/usr/bin/env node
/**
 * CI DEPENDENCY BOUNDARY CHECK
 * 
 * Verifies that architecture dependency boundaries are respected.
 * Part of Layer 4 (CI Architecture Gate).
 * 
 * Rules:
 *   - E7.1 cannot import from E7.2, E7.3, Products
 *   - E7.2 cannot import from E7.3, Products
 *   - E7.3 cannot import from Products
 *   - Products CAN import from E7.1, E7.2, E7.3
 * 
 * Exit codes:
 *   0 = No boundary violations
 *   1 = Boundary violations detected (blocks PR)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================================
// DEPENDENCY RULES
// ============================================================================

const LAYERS = {
  'E7.1': {
    name: 'E7.1 Domain Kernel',
    paths: ['src/platform/logistics/domain'],
    excludePaths: [
      'src/platform/logistics/domain/rules',
      'src/platform/logistics/domain/inventory-operations.domain.ts',
    ],
    forbiddenImports: [
      'inventory-operations.domain',              // Cannot import E7.2
      'src/platform/logistics/domain/rules',      // Cannot import E7.3
      'src/products/',                            // Cannot import Products
      'src/workflows/',                           // Cannot import Workflows
      '/notification/',                           // Cannot import Notification services
      '/task/',                                   // Cannot import Task services
    ],
  },
  'E7.2': {
    name: 'E7.2 Operational Kernel',
    paths: ['src/platform/logistics/domain/inventory-operations.domain.ts'],
    forbiddenImports: [
      'src/platform/logistics/domain/rules',      // Cannot import E7.3
      'src/products/',                            // Cannot import Products
      'src/workflows/',                           // Cannot import Workflows
      '/notification/',                           // Cannot import Notification services
      '/task/',                                   // Cannot import Task services
    ],
  },
  'E7.3': {
    name: 'E7.3 Rules & Traceability',
    paths: ['src/platform/logistics/domain/rules'],
    forbiddenImports: [
      'src/products/',                            // Cannot import Products
      'src/workflows/',                           // Cannot import Workflows
      '/warehouse/',                              // Cannot import Warehouse
      '/finance/',                                // Cannot import Finance
      '/qa/',                                     // Cannot import QA
      '/notification/',                           // Cannot import Notification services
      '/task/',                                   // Cannot import Task services
      '/recall/',                                 // Cannot import Recall services
      '/quarantine/',                             // Cannot import Quarantine services
    ],
  },
};

// ============================================================================
// UTILITIES
// ============================================================================

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function getLayerForFile(filePath) {
  const normalized = normalizePath(filePath);
  
  // Check E7.3 first (most specific)
  if (normalized.includes('src/platform/logistics/domain/rules')) {
    return 'E7.3';
  }
  
  // Check E7.2
  if (normalized.includes('inventory-operations.domain.ts')) {
    return 'E7.2';
  }
  
  // Check E7.1 (remaining domain files)
  if (normalized.includes('src/platform/logistics/domain')) {
    return 'E7.1';
  }
  
  return null;
}

function extractImports(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Match import statements
    const importRegex = /import\s+.*?from\s+['"](.+?)['"]/g;
    const imports = [];
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  } catch (error) {
    return [];
  }
}

function isForbiddenImport(importPath, forbiddenPatterns) {
  // Relative imports within same directory are always allowed
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    return false;
  }
  
  const normalized = normalizePath(importPath);
  
  return forbiddenPatterns.some(pattern => {
    const normalizedPattern = normalizePath(pattern);
    
    if (normalizedPattern.endsWith('/')) {
      return normalized.startsWith(normalizedPattern) || normalized.includes(normalizedPattern);
    }
    
    return normalized.includes(normalizedPattern);
  });
}

function getChangedFiles() {
  try {
    const baseBranch = process.env.GITHUB_BASE_REF || 'origin/main';
    
    const output = execSync(
      `git diff --name-only --diff-filter=AM ${baseBranch}...HEAD`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    
    return output
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .filter(file => file.endsWith('.ts') || file.endsWith('.tsx'));
  } catch (error) {
    // If we can't get changed files, check all kernel files
    console.warn('Could not get changed files, checking all kernel files...');
    return getAllKernelFiles();
  }
}

function getAllKernelFiles() {
  const kernelFiles = [];
  
  function walkDir(dir) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        if (!file.startsWith('__tests__')) {
          walkDir(filePath);
        }
      } else if (file.endsWith('.ts') && !file.endsWith('.test.ts')) {
        kernelFiles.push(filePath);
      }
    }
  }
  
  walkDir('src/platform/logistics/domain');
  
  return kernelFiles;
}

// ============================================================================
// CHECKS
// ============================================================================

function checkDependencyBoundaries() {
  console.log('🔗 CI Architecture Gate — Dependency Boundary Check');
  console.log('   Verifying kernel dependency boundaries...\n');
  
  const violations = [];
  const changedFiles = getChangedFiles();
  
  console.log(`   📋 Checking ${changedFiles.length} file(s)...\n`);
  
  for (const file of changedFiles) {
    const layer = getLayerForFile(file);
    
    if (!layer) {
      // Not a kernel file, skip
      continue;
    }
    
    const layerConfig = LAYERS[layer];
    const imports = extractImports(file);
    
    for (const importPath of imports) {
      if (isForbiddenImport(importPath, layerConfig.forbiddenImports)) {
        violations.push({
          file,
          layer: layerConfig.name,
          importPath,
        });
      }
    }
  }
  
  return violations;
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  const violations = checkDependencyBoundaries();
  
  if (violations.length === 0) {
    console.log('   ✅ No dependency boundary violations');
    console.log('   ✅ Architecture boundaries preserved');
    console.log('   ✅ Check passed\n');
    
    console.log('Dependency rules verified:');
    console.log('  • E7.1 → cannot import E7.2, E7.3, Products ✅');
    console.log('  • E7.2 → cannot import E7.3, Products ✅');
    console.log('  • E7.3 → cannot import Products ✅\n');
    
    process.exit(0);
  }
  
  // Violations detected
  console.error('╔════════════════════════════════════════════════════════════════╗');
  console.error('║  ❌ DEPENDENCY BOUNDARY VIOLATION — PR BLOCKED                ║');
  console.error('╚════════════════════════════════════════════════════════════════╝\n');
  
  console.error(`Found ${violations.length} forbidden import(s):\n`);
  
  // Group by layer
  const byLayer = violations.reduce((acc, v) => {
    if (!acc[v.layer]) acc[v.layer] = [];
    acc[v.layer].push(v);
    return acc;
  }, {});
  
  for (const [layer, layerViolations] of Object.entries(byLayer)) {
    console.error(`${layer}:\n`);
    
    for (const violation of layerViolations) {
      console.error(`  ❌ File: ${violation.file}`);
      console.error(`     Forbidden import: ${violation.importPath}\n`);
    }
  }
  
  console.error('╔════════════════════════════════════════════════════════════════╗');
  console.error('║  ARCHITECTURE DEPENDENCY RULES                                 ║');
  console.error('╚════════════════════════════════════════════════════════════════╝\n');
  
  console.error('Dependency flow (allowed direction):');
  console.error('');
  console.error('  Products');
  console.error('      ↓');
  console.error('    E7.3 Rules & Traceability');
  console.error('      ↓');
  console.error('    E7.2 Operational Kernel');
  console.error('      ↓');
  console.error('    E7.1 Domain Kernel');
  console.error('');
  console.error('Forbidden imports:');
  console.error('  • E7.1 ↛ E7.2, E7.3, Products');
  console.error('  • E7.2 ↛ E7.3, Products');
  console.error('  • E7.3 ↛ Products\n');
  
  console.error('Why this matters:');
  console.error('  • Lower layers should not depend on higher layers');
  console.error('  • Kernel should not depend on Products');
  console.error('  • This ensures clean separation and reusability\n');
  
  console.error('To fix:');
  console.error('  1. Remove forbidden imports');
  console.error('  2. Restructure code to respect layer boundaries');
  console.error('  3. If needed, move shared logic to appropriate layer');
  console.error('  4. Consume kernel APIs instead of importing internal details\n');
  
  console.error('Reference: docs/architecture/FREEZE_POLICY.md\n');
  
  console.error('╔════════════════════════════════════════════════════════════════╗');
  console.error('║  PR CANNOT BE MERGED                                           ║');
  console.error('╚════════════════════════════════════════════════════════════════╝\n');
  
  process.exit(1);
}

// Handle errors
try {
  main();
} catch (error) {
  console.error('❌ Dependency Boundary Check failed with error:');
  console.error(error.message);
  console.error('\nThis check is critical for architecture integrity.');
  console.error('Contact Platform Architecture Team if you believe this is an error.\n');
  process.exit(1);
}
