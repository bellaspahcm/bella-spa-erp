#!/usr/bin/env node
/**
 * Scan for `any` Type Violations
 * 
 * Scans codebase for `any` type usage (Constitution Law 11 violation).
 * Generates report with file paths, line numbers, and remediation priority.
 * 
 * Usage:
 *   node scripts/scan-any-types.js
 *   node scripts/scan-any-types.js --output report.json
 *   node scripts/scan-any-types.js --fix-priority high
 * 
 * Constitution: Law 11 (Strictly No `any` Types Allowed)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const SRC_DIRS = ['src/', 'app/', 'lib/', 'hooks/', 'components/'];
const EXCLUDE_DIRS = ['node_modules', '.next', 'dist', 'build', '__tests__'];
const FILE_EXTENSIONS = ['.ts', '.tsx'];

// Priority classification
const HIGH_PRIORITY_PATHS = ['src/platform/', 'src/services/', 'src/lib/business-rules/'];
const MEDIUM_PRIORITY_PATHS = ['src/hooks/', 'src/components/'];
const LOW_PRIORITY_PATHS = ['src/app/', 'src/modules/'];

// Violation patterns
const ANY_TYPE_PATTERNS = [
  /:\s*any\b/g,                    // : any
  /<any>/g,                        // <any>
  /Array<any>/g,                   // Array<any>
  /Promise<any>/g,                 // Promise<any>
  /Record<string,\s*any>/g,        // Record<string, any>
  /\bas\s+any\b/g,                 // as any
  /\bany\[\]/g,                    // any[]
];

class AnyTypeScanner {
  constructor() {
    this.violations = [];
    this.totalFiles = 0;
    this.filesWithViolations = 0;
  }

  scan() {
    console.log('🔍 Scanning for `any` type violations...\n');
    
    for (const dir of SRC_DIRS) {
      if (fs.existsSync(dir)) {
        this.scanDirectory(dir);
      }
    }

    this.generateReport();
  }

  scanDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!EXCLUDE_DIRS.includes(entry.name)) {
          this.scanDirectory(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (FILE_EXTENSIONS.includes(ext)) {
          this.scanFile(fullPath);
        }
      }
    }
  }

  scanFile(filePath) {
    this.totalFiles++;

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    let fileHasViolations = false;

    lines.forEach((line, index) => {
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        return;
      }

      for (const pattern of ANY_TYPE_PATTERNS) {
        const matches = line.match(pattern);
        if (matches) {
          fileHasViolations = true;

          this.violations.push({
            file: filePath,
            line: index + 1,
            column: line.indexOf('any'),
            content: line.trim(),
            pattern: pattern.source,
            priority: this.getPriority(filePath),
          });
        }
      }
    });

    if (fileHasViolations) {
      this.filesWithViolations++;
    }
  }

  getPriority(filePath) {
    if (HIGH_PRIORITY_PATHS.some(p => filePath.startsWith(p))) {
      return 'HIGH';
    }
    if (MEDIUM_PRIORITY_PATHS.some(p => filePath.startsWith(p))) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  generateReport() {
    console.log('\n📊 Scan Results:');
    console.log('═'.repeat(80));
    console.log(`Total files scanned: ${this.totalFiles}`);
    console.log(`Files with violations: ${this.filesWithViolations}`);
    console.log(`Total violations: ${this.violations.length}`);
    console.log('═'.repeat(80));

    // Group by priority
    const byPriority = {
      HIGH: this.violations.filter(v => v.priority === 'HIGH'),
      MEDIUM: this.violations.filter(v => v.priority === 'MEDIUM'),
      LOW: this.violations.filter(v => v.priority === 'LOW'),
    };

    console.log(`\n🔴 HIGH Priority: ${byPriority.HIGH.length} violations`);
    console.log(`🟡 MEDIUM Priority: ${byPriority.MEDIUM.length} violations`);
    console.log(`🟢 LOW Priority: ${byPriority.LOW.length} violations`);

    // Show top violators
    console.log('\n📁 Top 10 Files with Most Violations:');
    console.log('─'.repeat(80));

    const fileViolationCounts = {};
    this.violations.forEach(v => {
      fileViolationCounts[v.file] = (fileViolationCounts[v.file] || 0) + 1;
    });

    const sorted = Object.entries(fileViolationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    sorted.forEach(([file, count], index) => {
      console.log(`${index + 1}. ${file}: ${count} violations`);
    });

    // Estimate remediation effort
    const hoursEstimate = Math.ceil(this.violations.length / 20); // 20 violations per hour
    console.log(`\n⏱️  Estimated remediation effort: ${hoursEstimate} hours`);

    // Save JSON report
    const reportPath = 'reports/any-type-violations.json';
    fs.mkdirSync('reports', { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({
      summary: {
        totalFiles: this.totalFiles,
        filesWithViolations: this.filesWithViolations,
        totalViolations: this.violations.length,
        byPriority: {
          high: byPriority.HIGH.length,
          medium: byPriority.MEDIUM.length,
          low: byPriority.LOW.length,
        },
        estimatedHours: hoursEstimate,
      },
      violations: this.violations,
      topViolators: sorted.map(([file, count]) => ({ file, count })),
    }, null, 2));

    console.log(`\n✅ Report saved to: ${reportPath}`);

    // Generate remediation plan
    this.generateRemediationPlan();
  }

  generateRemediationPlan() {
    const planPath = 'docs/architecture/ANY_TYPE_REMEDIATION_PLAN.md';
    const plan = `# \`any\` Type Violations Remediation Plan

**Generated:** ${new Date().toISOString()}  
**Total Violations:** ${this.violations.length}  
**Estimated Effort:** ${Math.ceil(this.violations.length / 20)} hours  
**Constitution:** Law 11 (Strictly No \`any\` Types Allowed)

---

## Summary

| Priority | Count | % of Total |
|----------|-------|------------|
| 🔴 HIGH  | ${this.violations.filter(v => v.priority === 'HIGH').length} | ${Math.round(this.violations.filter(v => v.priority === 'HIGH').length / this.violations.length * 100)}% |
| 🟡 MEDIUM | ${this.violations.filter(v => v.priority === 'MEDIUM').length} | ${Math.round(this.violations.filter(v => v.priority === 'MEDIUM').length / this.violations.length * 100)}% |
| 🟢 LOW   | ${this.violations.filter(v => v.priority === 'LOW').length} | ${Math.round(this.violations.filter(v => v.priority === 'LOW').length / this.violations.length * 100)}% |

---

## Remediation Strategy

### Phase 1: HIGH Priority (Week 5)
- Fix platform engines (\`src/platform/\`)
- Fix business rules (\`src/lib/business-rules/\`)
- Fix core services (\`src/services/\`)
- **Effort:** ~${Math.ceil(this.violations.filter(v => v.priority === 'HIGH').length / 20)} hours

### Phase 2: MEDIUM Priority (Week 6)
- Fix hooks (\`src/hooks/\`)
- Fix reusable components (\`src/components/\`)
- **Effort:** ~${Math.ceil(this.violations.filter(v => v.priority === 'MEDIUM').length / 20)} hours

### Phase 3: LOW Priority (Post-Phase 0)
- Fix app pages (\`src/app/\`)
- Fix module-specific code (\`src/modules/\`)
- **Effort:** ~${Math.ceil(this.violations.filter(v => v.priority === 'LOW').length / 20)} hours

---

## Common Patterns & Fixes

### Pattern 1: Function Parameters
\`\`\`typescript
// ❌ BAD
function process(data: any) { ... }

// ✅ GOOD
function process(data: ProcessRequest) { ... }
function process<T>(data: T) { ... }
\`\`\`

### Pattern 2: API Responses
\`\`\`typescript
// ❌ BAD
const { data }: any = await fetch(...);

// ✅ GOOD
const { data }: { data: ResponseType } = await fetch(...);
\`\`\`

### Pattern 3: Event Handlers
\`\`\`typescript
// ❌ BAD
const handleClick = (e: any) => { ... }

// ✅ GOOD
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => { ... }
\`\`\`

### Pattern 4: Generic Collections
\`\`\`typescript
// ❌ BAD
const items: any[] = [];

// ✅ GOOD
const items: Item[] = [];
const items: Array<Item> = [];
\`\`\`

---

## Enforcement

### ESLint Rule (Add to .eslintrc.js)
\`\`\`javascript
{
  rules: {
    '@typescript-eslint/no-explicit-any': 'error', // Block new violations
  }
}
\`\`\`

### Pre-commit Hook
\`\`\`bash
# .husky/pre-commit
npm run lint -- --max-warnings 0
\`\`\`

---

## Progress Tracking

- [ ] Phase 1: HIGH priority violations fixed (${this.violations.filter(v => v.priority === 'HIGH').length} violations)
- [ ] Phase 2: MEDIUM priority violations fixed (${this.violations.filter(v => v.priority === 'MEDIUM').length} violations)
- [ ] Phase 3: LOW priority violations fixed (${this.violations.filter(v => v.priority === 'LOW').length} violations)
- [ ] ESLint rule enabled
- [ ] Pre-commit hook added
- [ ] Constitution Law 11 compliance: 100%

---

**Next Steps:**
1. Run \`node scripts/scan-any-types.js\` to regenerate report
2. Start with HIGH priority files (platform engines)
3. Enable ESLint rule after HIGH priority fixed
4. Add pre-commit hook to prevent new violations
`;

    fs.writeFileSync(planPath, plan);
    console.log(`✅ Remediation plan saved to: ${planPath}`);
  }
}

// Run scanner
const scanner = new AnyTypeScanner();
scanner.scan();

console.log('\n💡 Next Steps:');
console.log('1. Review report: reports/any-type-violations.json');
console.log('2. Review plan: docs/architecture/ANY_TYPE_REMEDIATION_PLAN.md');
console.log('3. Start with HIGH priority violations (platform engines)');
console.log('4. Enable ESLint rule after HIGH priority fixed');
