#!/usr/bin/env node

/**
 * Check for 'any' type violations in TypeScript files
 * Enforces Law 11: Strictly No `any` Types Allowed
 * 
 * Usage:
 *   node scripts/check-any-types.js
 *   npm run check:any-types
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

// Directories to scan
const includeDirs = [
  'src',
];

// Directories to exclude
const excludeDirs = [
  'node_modules',
  'archive-old-decision-engine',
  '.next',
  'dist',
  'build',
];

// Patterns to detect 'any' type
const anyPatterns = [
  /:\s*any\b/g,           // : any
  /:\s*any\[/g,           // : any[]
  /:\s*any\{/g,           // : any{}
  /as\s+any\b/g,          // as any
  /\bany\[\]/g,           // any[]
  /<any>/g,               // <any>
  /Promise<any>/g,        // Promise<any>
  /Record<.*,\s*any>/g,   // Record<..., any>
];

// Allowed exceptions (with justification)
const allowedExceptions = [
  // Test files can use 'any' for mocks (but should be minimized)
  // { file: 'src/__tests__/*.test.ts', reason: 'Test mocks' },
];

class AnyTypeChecker {
  constructor() {
    this.violations = [];
    this.totalFiles = 0;
    this.totalLines = 0;
  }

  /**
   * Scan directory recursively for TypeScript files
   */
  scanDirectory(dir, results = []) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        // Skip excluded directories
        if (excludeDirs.includes(file)) {
          continue;
        }
        this.scanDirectory(filePath, results);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(filePath);
      }
    }

    return results;
  }

  /**
   * Check a single file for 'any' type violations
   */
  checkFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const fileViolations = [];

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // Skip comments
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*')) {
        return;
      }

      // Check each pattern
      for (const pattern of anyPatterns) {
        const matches = line.match(pattern);
        if (matches) {
          fileViolations.push({
            line: lineNumber,
            content: line.trim(),
            pattern: pattern.toString(),
          });
        }
      }
    });

    if (fileViolations.length > 0) {
      this.violations.push({
        file: filePath,
        violations: fileViolations,
      });
    }

    this.totalFiles++;
    this.totalLines += lines.length;
  }

  /**
   * Run the checker
   */
  run() {
    console.log(`${colors.bold}${colors.cyan}🔍 Checking for 'any' type violations...${colors.reset}\n`);

    // Scan all TypeScript files
    const files = [];
    for (const dir of includeDirs) {
      if (fs.existsSync(dir)) {
        this.scanDirectory(dir, files);
      }
    }

    console.log(`Scanning ${files.length} TypeScript files...\n`);

    // Check each file
    for (const file of files) {
      this.checkFile(file);
    }

    // Report results
    this.report();
  }

  /**
   * Generate report
   */
  report() {
    console.log(`${colors.bold}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}          ANY TYPE VIOLATION REPORT${colors.reset}`);
    console.log(`${colors.bold}═══════════════════════════════════════════════════════${colors.reset}\n`);

    if (this.violations.length === 0) {
      console.log(`${colors.green}${colors.bold}✅ SUCCESS: No 'any' type violations found!${colors.reset}\n`);
      console.log(`Scanned ${this.totalFiles} files (${this.totalLines.toLocaleString()} lines)\n`);
      console.log(`${colors.green}Law 11 Compliance: 100%${colors.reset}\n`);
      return;
    }

    // Count total violations
    const totalViolations = this.violations.reduce(
      (sum, file) => sum + file.violations.length,
      0
    );

    console.log(`${colors.red}${colors.bold}❌ VIOLATION: ${totalViolations} 'any' types found in ${this.violations.length} files${colors.reset}\n`);

    // Group by priority
    const priorityGroups = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };

    for (const fileViolation of this.violations) {
      const file = fileViolation.file;
      
      if (file.includes('src/platform/')) {
        priorityGroups.critical.push(fileViolation);
      } else if (file.includes('src/__tests__/')) {
        priorityGroups.high.push(fileViolation);
      } else if (file.includes('src/components/')) {
        priorityGroups.medium.push(fileViolation);
      } else if (file.includes('archive-')) {
        priorityGroups.low.push(fileViolation);
      } else {
        priorityGroups.high.push(fileViolation);
      }
    }

    // Report by priority
    this.reportPriority('CRITICAL', priorityGroups.critical, colors.red);
    this.reportPriority('HIGH', priorityGroups.high, colors.yellow);
    this.reportPriority('MEDIUM', priorityGroups.medium, colors.magenta);
    this.reportPriority('LOW', priorityGroups.low, colors.cyan);

    // Summary
    console.log(`${colors.bold}─────────────────────────────────────────────────────${colors.reset}\n`);
    console.log(`${colors.bold}Summary:${colors.reset}`);
    console.log(`  Total Files Scanned: ${this.totalFiles}`);
    console.log(`  Total Lines Scanned: ${this.totalLines.toLocaleString()}`);
    console.log(`  Files with Violations: ${this.violations.length}`);
    console.log(`  Total Violations: ${totalViolations}\n`);

    const compliance = (1 - (this.violations.length / this.totalFiles)) * 100;
    console.log(`${colors.bold}Law 11 Compliance: ${colors.red}${compliance.toFixed(1)}%${colors.reset}\n`);

    // Remediation guidance
    console.log(`${colors.bold}${colors.yellow}⚠️  Remediation Required:${colors.reset}`);
    console.log(`   See ANY_TYPE_VIOLATIONS_REPORT.md for fix patterns\n`);
    console.log(`${colors.bold}Enforcement:${colors.reset}`);
    console.log(`   - TypeScript: Enable strict mode and noImplicitAny`);
    console.log(`   - ESLint: Enable @typescript-eslint/no-explicit-any: error`);
    console.log(`   - Pre-commit: Block commits with 'any' types\n`);

    // Exit with error code
    process.exit(1);
  }

  /**
   * Report violations by priority
   */
  reportPriority(priority, violations, color) {
    if (violations.length === 0) {
      console.log(`${color}${colors.bold}${priority} Priority: ✅ CLEAN${colors.reset}\n`);
      return;
    }

    const totalCount = violations.reduce((sum, f) => sum + f.violations.length, 0);
    console.log(`${color}${colors.bold}${priority} Priority: ${totalCount} violations in ${violations.length} files${colors.reset}\n`);

    for (const fileViolation of violations) {
      console.log(`  ${colors.bold}${fileViolation.file}${colors.reset}`);
      console.log(`  ${fileViolation.violations.length} violation(s):\n`);

      for (const violation of fileViolation.violations.slice(0, 3)) {
        console.log(`    ${color}Line ${violation.line}:${colors.reset} ${violation.content}`);
      }

      if (fileViolation.violations.length > 3) {
        console.log(`    ${color}... and ${fileViolation.violations.length - 3} more${colors.reset}`);
      }

      console.log('');
    }
  }
}

// Run checker
const checker = new AnyTypeChecker();
checker.run();
