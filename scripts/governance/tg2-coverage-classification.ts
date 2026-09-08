#!/usr/bin/env tsx
/**
 * TG-2.1 — Coverage Classification Inventory
 * 
 * Purpose: Cluster-level analysis of uncovered production source
 * 
 * Outputs:
 * - Uncovered files grouped by top-level architecture cluster
 * - Coverage statistics per cluster
 * - Ownership/scope recommendations
 * 
 * Does NOT modify any files or scopes.
 */

import * as fs from 'fs';
import * as path from 'path';
import { enumerateProductionSource, buildCoverageRegistry, analyzeCoverage } from './tg2-production-coverage';

interface ClusterStats {
  cluster: string;
  totalFiles: number;
  coveredFiles: number;
  uncoveredFiles: number;
  coveragePercent: number;
  uncoveredSample: string[]; // First 5 uncovered files
  hasGovernedScope: boolean;
  scopeNames: string[];
}

/**
 * Top-level architecture clusters to analyze
 */
const ARCHITECTURE_CLUSTERS = [
  { pattern: /^src\/platform\//, name: 'Platform Core' },
  { pattern: /^src\/services\//, name: 'Services Layer' },
  { pattern: /^src\/products\//, name: 'Products' },
  { pattern: /^src\/kernels\//, name: 'Kernels' },
  { pattern: /^src\/modules\//, name: 'Modules' },
  { pattern: /^src\/app\//, name: 'Next.js App Routes' },
  { pattern: /^src\/components\//, name: 'UI Components' },
  { pattern: /^src\/lib\//, name: 'Library/Utilities' },
  { pattern: /^src\/shared\//, name: 'Shared Code' },
  { pattern: /^src\/types\//, name: 'Type Definitions' },
  { pattern: /^src\/__tests__\//, name: 'Test Infrastructure' },
  { pattern: /^packages\//, name: 'Workspace Packages' },
  { pattern: /^src\//, name: 'Other src/' },
];

/**
 * Classify file into architecture cluster
 */
function classifyFile(file: string): string {
  for (const cluster of ARCHITECTURE_CLUSTERS) {
    if (cluster.pattern.test(file)) {
      return cluster.name;
    }
  }
  return 'Unclassified';
}

/**
 * Analyze coverage by cluster
 */
function analyzeByCluster(
  productionFiles: string[],
  registry: { [file: string]: string[] }
): ClusterStats[] {
  const clusterMap = new Map<string, {
    files: string[];
    covered: string[];
    uncovered: string[];
    scopes: Set<string>;
  }>();

  // Initialize clusters
  for (const { name } of ARCHITECTURE_CLUSTERS) {
    clusterMap.set(name, {
      files: [],
      covered: [],
      uncovered: [],
      scopes: new Set(),
    });
  }
  clusterMap.set('Unclassified', {
    files: [],
    covered: [],
    uncovered: [],
    scopes: new Set(),
  });

  // Classify files
  for (const file of productionFiles) {
    const cluster = classifyFile(file);
    const data = clusterMap.get(cluster)!;
    
    data.files.push(file);
    
    const scopes = registry[file] || [];
    if (scopes.length > 0) {
      data.covered.push(file);
      scopes.forEach(scope => data.scopes.add(scope));
    } else {
      data.uncovered.push(file);
    }
  }

  // Build stats
  const stats: ClusterStats[] = [];
  
  for (const [cluster, data] of clusterMap.entries()) {
    if (data.files.length === 0) continue;
    
    const coveragePercent = data.files.length > 0
      ? Math.round((data.covered.length / data.files.length) * 100)
      : 0;
    
    stats.push({
      cluster,
      totalFiles: data.files.length,
      coveredFiles: data.covered.length,
      uncoveredFiles: data.uncovered.length,
      coveragePercent,
      uncoveredSample: data.uncovered.slice(0, 5),
      hasGovernedScope: data.scopes.size > 0,
      scopeNames: Array.from(data.scopes),
    });
  }

  // Sort by uncovered count (highest first)
  return stats.sort((a, b) => b.uncoveredFiles - a.uncoveredFiles);
}

/**
 * Detailed analysis for specific cluster
 */
function analyzeClusterDetails(
  clusterName: string,
  productionFiles: string[],
  registry: { [file: string]: string[] }
): {
  subclusters: Map<string, { files: string[]; covered: number; uncovered: number }>;
} {
  const clusterPattern = ARCHITECTURE_CLUSTERS.find(c => c.name === clusterName)?.pattern;
  if (!clusterPattern) {
    return { subclusters: new Map() };
  }

  const clusterFiles = productionFiles.filter(f => clusterPattern.test(f));
  const subclusters = new Map<string, { files: string[]; covered: number; uncovered: number }>();

  for (const file of clusterFiles) {
    // Extract subcluster (second-level directory)
    const match = file.match(/^([^/]+\/[^/]+)\//);
    const subcluster = match ? match[1] : file.split('/')[0];

    if (!subclusters.has(subcluster)) {
      subclusters.set(subcluster, { files: [], covered: 0, uncovered: 0 });
    }

    const data = subclusters.get(subcluster)!;
    data.files.push(file);

    const scopes = registry[file] || [];
    if (scopes.length > 0) {
      data.covered++;
    } else {
      data.uncovered++;
    }
  }

  return { subclusters };
}

/**
 * Generate classification report
 */
function generateReport(stats: ClusterStats[]): string {
  let report = `
╔═══════════════════════════════════════════════════════════════════════════╗
║                 TG-2.1 COVERAGE CLASSIFICATION INVENTORY                  ║
╚═══════════════════════════════════════════════════════════════════════════╝

PURPOSE:
  Cluster-level analysis of uncovered production source.
  Identifies architectural ownership gaps requiring governance scope assignment.

PRINCIPLE:
  Coverage remediation must follow ownership architecture,
  not merely optimize coverage percentage.

───────────────────────────────────────────────────────────────────────────

CLUSTER-LEVEL COVERAGE
`;

  const totalFiles = stats.reduce((sum, s) => sum + s.totalFiles, 0);
  const totalCovered = stats.reduce((sum, s) => sum + s.coveredFiles, 0);
  const totalUncovered = stats.reduce((sum, s) => sum + s.uncoveredFiles, 0);

  report += `\nOVERALL: ${totalCovered}/${totalFiles} files governed (${Math.round(totalCovered/totalFiles*100)}%)\n\n`;

  report += `${'CLUSTER'.padEnd(30)} ${'TOTAL'.padStart(6)} ${'COVERED'.padStart(8)} ${'GAP'.padStart(6)} ${'%'.padStart(5)} GOVERNED?\n`;
  report += '─'.repeat(80) + '\n';

  for (const stat of stats) {
    const governed = stat.hasGovernedScope ? '✅' : '❌';
    report += `${stat.cluster.padEnd(30)} ${stat.totalFiles.toString().padStart(6)} ${stat.coveredFiles.toString().padStart(8)} ${stat.uncoveredFiles.toString().padStart(6)} ${stat.coveragePercent.toString().padStart(4)}% ${governed}\n`;
  }

  report += '\n───────────────────────────────────────────────────────────────────────────\n\n';
  report += 'HIGH-PRIORITY CLUSTERS (largest coverage gaps):\n\n';

  // Top 5 clusters by uncovered count
  const highPriority = stats.filter(s => s.uncoveredFiles > 0).slice(0, 5);

  for (const stat of highPriority) {
    report += `\n${stat.cluster}\n`;
    report += `  Total: ${stat.totalFiles} files\n`;
    report += `  Uncovered: ${stat.uncoveredFiles} files\n`;
    report += `  Existing scopes: ${stat.scopeNames.length > 0 ? stat.scopeNames.join(', ') : 'NONE'}\n`;
    
    if (stat.uncoveredSample.length > 0) {
      report += `  Sample uncovered:\n`;
      for (const file of stat.uncoveredSample) {
        report += `    - ${file}\n`;
      }
      if (stat.uncoveredFiles > 5) {
        report += `    ... and ${stat.uncoveredFiles - 5} more\n`;
      }
    }
  }

  report += `
───────────────────────────────────────────────────────────────────────────

CLASSIFICATION CATEGORIES

Each uncovered file must be classified into ONE of:

A — EXISTING DOMAIN, MISSING GOVERNED SCOPE
    Production code with clear ownership
    No canonical typecheck scope exists
    → Action: CREATE/EXTEND proper governed scope

B — VALID PRODUCTION SHARED LAYER
    Shared services/utilities/platform code
    Not owned by single Product/OS
    → Action: CREATE shared governed scopes per architecture

C — NON-PRODUCTION MISCLASSIFIED
    Test helpers, fixtures, generated code, dev tooling, archived
    → Action: Explicit exclusion OR relocate
    → DO NOT "exclude for clean metrics"

D — ARCHITECTURAL ORPHAN
    Production-looking code
    Ownership unclear or architecture unmapped
    → Action: BLOCK / architectural decision required

───────────────────────────────────────────────────────────────────────────

NEXT ACTIONS

1. Healthcare Services (Field-Validated Gap)
   src/services/healthcare/** — ${stats.find(s => s.cluster === 'Services Layer')?.uncoveredFiles || '?'} uncovered files
   Decision: Determine correct governance scope ownership

2. Services Layer Coverage
   Determine if Healthcare is isolated or systemic services-layer gap

3. High-Priority Clusters
   Address top 3 clusters by architectural impact (not just file count)

4. Scope Registry Expansion
   Create missing governed scopes following ownership architecture

DO NOT:
  ❌ Add files blindly to nearest scope
  ❌ Create mega-scope to "eat" all uncovered
  ❌ Optimize for coverage % over architecture correctness

═══════════════════════════════════════════════════════════════════════════

See: docs/architecture/TG2_PRODUCTION_COVERAGE_INTEGRITY.md
     docs/architecture/TG2_SCOPE_QUALIFICATION_FINDING.md
`;

  return report;
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 TG-2.1 — Coverage Classification Inventory');
  console.log('');

  try {
    // Step 1: Load data
    console.log('📊 Loading production inventory...');
    const productionFiles = enumerateProductionSource();
    console.log(`   ${productionFiles.length} production files found`);

    console.log('📋 Building coverage registry...');
    const registry = buildCoverageRegistry();
    console.log(`   ${Object.keys(registry).length} files mapped to governed scopes`);

    // Step 2: Analyze by cluster
    console.log('');
    console.log('🔬 Analyzing coverage by architectural cluster...');
    const stats = analyzeByCluster(productionFiles, registry);

    // Step 3: Generate report
    const report = generateReport(stats);
    console.log(report);

    // Step 4: Write detailed report to file
    const reportPath = path.join(process.cwd(), '.tg2-coverage-classification.txt');
    fs.writeFileSync(reportPath, report, 'utf-8');
    console.log(`\n📄 Detailed report written to: ${reportPath}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
