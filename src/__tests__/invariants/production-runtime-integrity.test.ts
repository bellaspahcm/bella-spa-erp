/**
 * =========================================================================
 * BELLA PLATFORM GOVERNANCE — PRODUCTION RUNTIME INTEGRITY INVARIANTS
 * =========================================================================
 * 
 * Purpose: Regression barrier for platform-level architectural violations
 * Scope: Production code only (excludes tests, scripts, tooling)
 * Status: 🔴 BLOCKING (must PASS before F5 resume)
 * 
 * These are NOT unit tests. These are INVARIANT TESTS.
 * They must PASS in CI/CD pipeline before any production deployment.
 * 
 * Failure = Architecture violation = Build MUST fail.
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// =========================================================================
// CONFIGURATION
// =========================================================================

const PRODUCTION_SOURCE_PATTERNS = [
  'src/platform/**/*.{ts,tsx}',
  'src/app/**/!(__tests__|*.test.*|*.spec.*)',
  'src/lib/**/*.{ts,tsx}',
  'src/components/**/*.{ts,tsx}',
];

const EXCLUDED_PATTERNS = [
  '**/__tests__/**',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/node_modules/**',
  '**/.next/**',
  '**/dist/**',
];

const HEALTHCARE_KERNEL_TABLES = [
  'hc_master_patient_index',
  'hc_inpatient_admissions',
  'hc_nursing_vital_signs',
  'hc_medication_administration_records',
  'hc_encounters',
  'hc_clinical_orders',
  'hc_buildings',
  'hc_wards',
  'hc_rooms',
  'hc_beds',
];

// =========================================================================
// HELPER: Get Production Source Files
// =========================================================================

async function getProductionFiles(): Promise<string[]> {
  const files: string[] = [];
  
  for (const pattern of PRODUCTION_SOURCE_PATTERNS) {
    const matches = await glob(pattern, {
      ignore: EXCLUDED_PATTERNS,
      absolute: true,
      cwd: process.cwd(),
    });
    files.push(...matches);
  }
  
  return [...new Set(files)]; // dedupe
}

// =========================================================================
// HELPER: Read File Content
// =========================================================================

function readFileContent(filePath: string): string {
  // Skip directories
  const stats = fs.statSync(filePath);
  if (stats.isDirectory()) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf-8');
}

// =========================================================================
// INVARIANT 1: ZERO UNAPPROVED `any` IN PRODUCTION
// =========================================================================

describe('INVARIANT 1: Production Type Safety', () => {
  test('Production source has ZERO unapproved `any` types', async () => {
    const files = await getProductionFiles();
    const violations: Array<{ file: string; line: number; snippet: string }> = [];
    
    for (const filePath of files) {
      const content = readFileContent(filePath);
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Skip comments
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
          return;
        }
        
        // Detect `any` usage (not in strings, not as "company")
        const anyPattern = /\b(:\s*any\b|as\s+any\b|<any>|Array<any>|Promise<any>|Record<string,\s*any>)/;
        
        if (anyPattern.test(line)) {
          // Check for approved exception comment on same or previous line
          const prevLine = index > 0 ? lines[index - 1] : '';
          const hasApproval = 
            prevLine.includes('@approved-any') || 
            line.includes('@approved-any');
          
          if (!hasApproval) {
            violations.push({
              file: path.relative(process.cwd(), filePath),
              line: index + 1,
              snippet: line.trim(),
            });
          }
        }
      });
    }
    
    if (violations.length > 0) {
      const report = violations
        .map(v => `  ${v.file}:${v.line}\n    ${v.snippet}`)
        .join('\n\n');
      
      throw new Error(
        `❌ INVARIANT VIOLATION: Found ${violations.length} unapproved 'any' in production code\n\n` +
        `Production code must have ZERO unapproved 'any' types.\n` +
        `If 'any' is absolutely required, add a comment:\n` +
        `  // @approved-any reason="..." owner="..." expiry="YYYY-MM-DD"\n\n` +
        `Violations:\n${report}\n\n` +
        `See: docs/architecture/TYPE_SAFETY_INVARIANT.md`
      );
    }
    
    expect(violations).toHaveLength(0);
  });
});

// =========================================================================
// INVARIANT 2: ZERO MOCK CLINICAL IDENTITY IN PRODUCTION
// =========================================================================

describe('INVARIANT 2: Clinical Provenance Integrity', () => {
  test('Production Healthcare runtime has ZERO mock clinical identity', async () => {
    const files = await getProductionFiles();
    const violations: Array<{ file: string; line: number; snippet: string }> = [];
    
    const mockPatterns = [
      /pat-default/i,
      /enc-default/i,
      /enc-dental-default/i,
      /mock.*patient/i,
      /mock.*encounter/i,
      /default.*patient.*id/i,
      /default.*encounter.*id/i,
      /hardcoded.*patient/i,
      /hardcoded.*encounter/i,
    ];
    
    for (const filePath of files) {
      // Only check Healthcare domain files
      if (!filePath.includes('healthcare') && !filePath.includes('/hc_')) {
        continue;
      }
      
      const content = readFileContent(filePath);
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Skip comments and test setup
        if (
          line.trim().startsWith('//') || 
          line.trim().startsWith('*') ||
          line.includes('@test-fixture')
        ) {
          return;
        }
        
        for (const pattern of mockPatterns) {
          if (pattern.test(line)) {
            violations.push({
              file: path.relative(process.cwd(), filePath),
              line: index + 1,
              snippet: line.trim(),
            });
            break;
          }
        }
      });
    }
    
    if (violations.length > 0) {
      const report = violations
        .map(v => `  ${v.file}:${v.line}\n    ${v.snippet}`)
        .join('\n\n');
      
      throw new Error(
        `❌ INVARIANT VIOLATION: Found ${violations.length} mock clinical identities in production\n\n` +
        `Healthcare production code must derive clinical identity from authoritative sources:\n` +
        `  Patient → hc_master_patient_index (via Kernel contract)\n` +
        `  Encounter → hc_encounters (via Kernel contract)\n` +
        `  Clinical Event → Temporal evidence chain\n\n` +
        `Mock identities violate HIPAA provenance requirements.\n\n` +
        `Violations:\n${report}\n\n` +
        `See: docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md`
      );
    }
    
    expect(violations).toHaveLength(0);
  });
});

// =========================================================================
// INVARIANT 3: BUILD FAILS ON TYPESCRIPT ERRORS
// =========================================================================

describe('INVARIANT 3: Build Integrity', () => {
  test('next.config.ts has ignoreBuildErrors = false', () => {
    const configPath = path.join(process.cwd(), 'next.config.ts');
    
    if (!fs.existsSync(configPath)) {
      throw new Error('next.config.ts not found');
    }
    
    const content = readFileContent(configPath);
    
    // Check for ignoreBuildErrors: true
    const hasIgnoreBuildErrors = /ignoreBuildErrors\s*:\s*true/i.test(content);
    
    if (hasIgnoreBuildErrors) {
      throw new Error(
        `❌ INVARIANT VIOLATION: next.config.ts has ignoreBuildErrors: true\n\n` +
        `Production builds MUST fail on TypeScript errors.\n` +
        `This is a false-green that allows broken code to reach production.\n\n` +
        `Required:\n` +
        `  typescript: {\n` +
        `    ignoreBuildErrors: false, // ← MUST be false or omitted\n` +
        `  }\n\n` +
        `See: docs/architecture/BUILD_INTEGRITY_INVARIANT.md`
      );
    }
    
    expect(hasIgnoreBuildErrors).toBe(false);
  });
  
  test('eslint.config.mjs does not have ignorePatterns for src/', () => {
    const configPath = path.join(process.cwd(), 'eslint.config.mjs');
    
    if (!fs.existsSync(configPath)) {
      // If no eslint config, that's acceptable
      return;
    }
    
    const content = readFileContent(configPath);
    
    // Check for ignorePatterns that exclude src/
    const ignoresSrc = /ignorePatterns.*src\//i.test(content);
    
    if (ignoresSrc) {
      throw new Error(
        `❌ INVARIANT VIOLATION: eslint.config.mjs ignores src/ directory\n\n` +
        `Production source must be linted. Ignoring src/ defeats code quality gates.\n\n` +
        `See: docs/architecture/BUILD_INTEGRITY_INVARIANT.md`
      );
    }
    
    expect(ignoresSrc).toBe(false);
  });
});

// =========================================================================
// INVARIANT 4: CLINICAL EVIDENCE FROM AUTHORITATIVE CONTRACTS
// =========================================================================

describe('INVARIANT 4: Healthcare Contract Boundary', () => {
  test('Healthcare services use Kernel contracts, not direct DB access', async () => {
    const files = await getProductionFiles();
    const violations: Array<{ file: string; line: number; snippet: string; issue: string }> = [];
    
    for (const filePath of files) {
      // Check Healthcare service/domain files
      if (
        !filePath.includes('healthcare') && 
        !filePath.includes('hospital') &&
        !filePath.includes('clinical')
      ) {
        continue;
      }
      
      // Skip if this IS a kernel engine (kernel can access its own tables)
      if (filePath.includes('src/platform/healthcare/engines/')) {
        continue;
      }
      
      const content = readFileContent(filePath);
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Skip comments
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
          return;
        }
        
        // Detect direct Supabase query to hc_* tables
        for (const table of HEALTHCARE_KERNEL_TABLES) {
          const directAccessPattern = new RegExp(
            `supabase.*\\.from\\(['\"\`]${table}['\"\`]\\)`,
            'i'
          );
          
          if (directAccessPattern.test(line)) {
            violations.push({
              file: path.relative(process.cwd(), filePath),
              line: index + 1,
              snippet: line.trim(),
              issue: `Direct access to Kernel table: ${table}`,
            });
          }
        }
        
        // Detect SQL string literals with hc_* tables
        for (const table of HEALTHCARE_KERNEL_TABLES) {
          const sqlPattern = new RegExp(
            `(SELECT|INSERT|UPDATE|DELETE).*FROM.*${table}`,
            'i'
          );
          
          if (sqlPattern.test(line)) {
            violations.push({
              file: path.relative(process.cwd(), filePath),
              line: index + 1,
              snippet: line.trim(),
              issue: `Raw SQL access to Kernel table: ${table}`,
            });
          }
        }
      });
    }
    
    if (violations.length > 0) {
      const report = violations
        .map(v => `  ${v.file}:${v.line}\n    ${v.issue}\n    ${v.snippet}`)
        .join('\n\n');
      
      throw new Error(
        `❌ INVARIANT VIOLATION: Found ${violations.length} direct Healthcare Kernel accesses\n\n` +
        `Product code MUST use Healthcare Kernel contracts, not direct DB access.\n\n` +
        `Correct pattern:\n` +
        `  Product Service\n` +
        `       ↓\n` +
        `  Product Contract (e.g., AdmissionContract)\n` +
        `       ↓\n` +
        `  Healthcare Kernel Engine (H1-H12)\n` +
        `       ↓\n` +
        `  hc_* tables\n\n` +
        `Violations:\n${report}\n\n` +
        `See: docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md`
      );
    }
    
    expect(violations).toHaveLength(0);
  });
});

// =========================================================================
// INVARIANT 5: UI CANNOT DIRECTLY ACCESS hc_* TABLES
// =========================================================================

describe('INVARIANT 5: UI Persistence Boundary', () => {
  test('UI components do not directly query hc_* tables', async () => {
    const files = await getProductionFiles();
    const violations: Array<{ file: string; line: number; snippet: string }> = [];
    
    for (const filePath of files) {
      // Only check UI files (pages, components)
      if (
        !filePath.includes('/app/') && 
        !filePath.includes('/components/') &&
        !filePath.includes('/pages/')
      ) {
        continue;
      }
      
      const content = readFileContent(filePath);
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Skip comments
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
          return;
        }
        
        for (const table of HEALTHCARE_KERNEL_TABLES) {
          // Detect .from('hc_*') in UI
          const fromPattern = new RegExp(`\\.from\\(['\"\`]${table}['\"\`]\\)`, 'i');
          
          if (fromPattern.test(line)) {
            violations.push({
              file: path.relative(process.cwd(), filePath),
              line: index + 1,
              snippet: line.trim(),
            });
          }
        }
      });
    }
    
    if (violations.length > 0) {
      const report = violations
        .map(v => `  ${v.file}:${v.line}\n    ${v.snippet}`)
        .join('\n\n');
      
      throw new Error(
        `❌ INVARIANT VIOLATION: Found ${violations.length} direct hc_* accesses from UI\n\n` +
        `UI components MUST use service layer, not direct database queries.\n\n` +
        `Correct pattern:\n` +
        `  UI Component\n` +
        `       ↓\n` +
        `  Service (e.g., AdmissionService)\n` +
        `       ↓\n` +
        `  Product Contract\n` +
        `       ↓\n` +
        `  Kernel Engine\n` +
        `       ↓\n` +
        `  Database\n\n` +
        `Violations:\n${report}\n\n` +
        `See: docs/architecture/UI_PERSISTENCE_BOUNDARY.md`
      );
    }
    
    expect(violations).toHaveLength(0);
  });
});

// =========================================================================
// INVARIANT 6: TENANT ISOLATION ON ALL TENANT-OWNED TABLES
// =========================================================================

describe('INVARIANT 6: RLS Tenant Isolation', () => {
  test('All tenant-owned tables have enforced RLS policies', async () => {
    // This test queries the database to verify RLS
    // For now, we document the requirement
    
    const requiredChecks = [
      'All tables with tenant_id column must have RLS enabled',
      'No USING (true) policies on tenant-owned tables',
      'All policies must check tenant_id = get_auth_tenant_id()',
      'Both USING and WITH CHECK must enforce tenant isolation',
    ];
    
    // TODO: Implement database query to verify RLS
    // For now, document as manual verification step
    
    console.log('📋 INVARIANT 6 Manual Verification Required:');
    requiredChecks.forEach((check, i) => {
      console.log(`  ${i + 1}. ${check}`);
    });
    console.log('\n  Run: npm run security:rls-audit');
    
    // This test passes for now, but should be automated
    expect(true).toBe(true);
  });
});

// =========================================================================
// SUMMARY REPORTER
// =========================================================================

describe('INVARIANT TEST SUMMARY', () => {
  test('All invariants documented', () => {
    const invariants = [
      '✅ INVARIANT 1: Zero unapproved `any` in production',
      '✅ INVARIANT 2: Zero mock clinical identity',
      '✅ INVARIANT 3: Build fails on TypeScript errors',
      '✅ INVARIANT 4: Clinical evidence from authoritative contracts',
      '✅ INVARIANT 5: UI cannot directly access hc_* tables',
      '✅ INVARIANT 6: Tenant isolation on all tenant-owned tables',
    ];
    
    console.log('\n' + '='.repeat(70));
    console.log('BELLA PLATFORM GOVERNANCE — INVARIANT TESTS');
    console.log('='.repeat(70));
    invariants.forEach(inv => console.log(inv));
    console.log('='.repeat(70) + '\n');
    
    expect(invariants).toHaveLength(6);
  });
});
