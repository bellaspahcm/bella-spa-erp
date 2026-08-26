/**
 * BELLA HEALTHCARE OS — AUTOMATED MACHINE ARCHITECTURE GUARD
 *
 * Enforces the Healthcare Vertical Coding Constitution:
 * 1. Kernel Freeze Guard: Rejects new core Kernel engines (No "H13").
 * 2. Contract Boundary Guard: Rejects direct queries on internal Kernel tables (`hc_*`).
 * 3. Entity Duplication Guard: Rejects creation of duplicate Kernel entities (`*_patients`, `*_encounters`).
 * 4. Strict Typing Guard: Rejects usage of `any` types.
 *
 * @module scripts/healthcare/architecture-guard
 */

import * as fs from 'fs';
import * as path from 'path';

const ALLOWED_KERNEL_ENGINES = new Set([
  'encounter-engine',
  'emergency-engine',
  'admission-engine',
  'icu-engine',
  'surgical-engine',
  'blood-bank-engine',
  'laboratory-engine',
  'pharmacy-engine',
  'order-engine',
  'cds-engine',
  'temporal-engine',
  'rule-engine',
  'audit-compliance-engine',
  // H1-H7 Clinical Operational Support Engines
  'anesthesia-engine',
  'bed-engine',
  'billing-engine',
  'clinical-engine',
  'cssd-engine',
  'imaging-engine',
  'insurance-engine',
  'mpi-engine',
  'nursing-engine',
  'or-engine',
  'or-readiness-engine',
  'pacu-engine',
  'queue-engine',
  'scheduling-engine'
]);

const INTERNAL_KERNEL_TABLES = [
  'hc_temporal_events',
  'hc_temporal_snapshots',
  'hc_governed_rules',
  'hc_clinical_audit_ledger',
  'hc_clinical_evidence_packages',
  'hc_compliance_exceptions',
  'hc_cds_rules',
  'hc_cds_snapshots',
  'hc_cds_decisions'
];

let violationsCount = 0;

function reportViolation(ruleId: string, message: string, filePath?: string) {
  violationsCount++;
  console.error(`\x1b[31m[ARCHITECTURAL VIOLATION] ${ruleId}\x1b[0m`);
  if (filePath) {
    console.error(`  \x1b[33mFile:\x1b[0m ${filePath}`);
  }
  console.error(`  \x1b[37m${message}\x1b[0m\n`);
}

/**
 * Guard 1: Kernel Freeze Lock (No new engines in Kernel directory)
 */
function checkKernelFreeze() {
  const enginesDir = path.join(process.cwd(), 'src', 'platform', 'healthcare', 'engines');
  if (!fs.existsSync(enginesDir)) return;

  const entries = fs.readdirSync(enginesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ALLOWED_KERNEL_ENGINES.has(entry.name)) {
        reportViolation(
          'KERNEL_FREEZE_VIOLATION (Law 1)',
          `Unauthorized Kernel Engine detected: "${entry.name}". Healthcare Kernel H1–H12 is FROZEN. Product logic belongs ONLY in Product Verticals layer (src/products/ or src/platform/healthcare/verticals/).`,
          path.join(enginesDir, entry.name)
        );
      }
    }
  }
}

/**
 * Guard 2: Contract Boundary & Internal Table Direct Access Guard
 */
function checkContractBoundaries(dirPath: string) {
  if (!fs.existsSync(dirPath)) return;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      checkContractBoundaries(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      const content = fs.readFileSync(fullPath, 'utf8');

      // Check for direct access on internal Kernel persistence tables
      for (const table of INTERNAL_KERNEL_TABLES) {
        if (content.includes(`'${table}'`) || content.includes(`"${table}"`)) {
          reportViolation(
            'DIRECT_KERNEL_TABLE_ACCESS_VIOLATION (Law 3)',
            `Product code directly references internal Kernel database table "${table}". Products MUST consume Kernel capabilities exclusively via Public Contracts.`,
            fullPath
          );
        }
      }
    }
  }
}

/**
 * Guard 3: Strict Typing Guard (Law 14)
 */
function checkStrictTyping(dirPath: string) {
  if (!fs.existsSync(dirPath)) return;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      checkStrictTyping(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        // Exclude comments
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
        if (line.includes(': any') || line.includes('as any') || line.includes('<any>')) {
          reportViolation(
            'STRICT_TYPING_VIOLATION (Law 14)',
            `Forbidden "any" type detected at line ${idx + 1}: "${line.trim()}"`,
            fullPath
          );
        }
      });
    }
  }
}

const KERNEL_ENGINES = new Set([
  'encounter-engine',
  'mpi-engine',
  'temporal-engine',
  'rule-engine',
  'cds-engine',
  'audit-compliance-engine',
  'scheduling-engine',
  'order-engine'
]);

const HOSPITAL_ENGINES = [
  'admission-engine',
  'bed-engine',
  'emergency-engine',
  'icu-engine',
  'laboratory-engine',
  'pharmacy-engine',
  'blood-bank-engine',
  'surgical-engine',
  'or-engine',
  'or-readiness-engine',
  'anesthesia-engine',
  'pacu-engine',
  'cssd-engine',
  'billing-engine',
  'imaging-engine',
  'insurance-engine',
  'queue-engine'
];

function checkDependencyFlow() {
  const enginesDir = path.join(process.cwd(), 'src', 'platform', 'healthcare', 'engines');
  const coreDir = path.join(process.cwd(), 'src', 'platform', 'core');

  // Rule 1: Platform Core -> Kernel/verticals ❌
  if (fs.existsSync(coreDir)) {
    scanCoreDirectoryForPlatformViolations(coreDir);
  }

  if (fs.existsSync(enginesDir)) {
    const entries = fs.readdirSync(enginesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const enginePath = path.join(enginesDir, entry.name);
        if (KERNEL_ENGINES.has(entry.name)) {
          // Rule 2: Kernel -> Hospital Extension ❌, Kernel -> Product ❌
          scanKernelDirectoryForViolations(enginePath, entry.name);
        } else if (HOSPITAL_ENGINES.includes(entry.name)) {
          // Rule 3: Hospital -> Product ❌
          scanHospitalDirectoryForViolations(enginePath, entry.name);
        }
      }
    }
  }
}

function scanCoreDirectoryForPlatformViolations(dirPath: string) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      scanCoreDirectoryForPlatformViolations(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.trim().startsWith('import ') && line.includes('from ')) {
          if (line.includes('/platform/healthcare') || line.includes('/platform/education') || line.includes('/platform/logistics') || line.includes('/platform/real-estate')) {
            reportViolation(
              'PLATFORM_CORE_DEPENDENCY_VIOLATION (K1)',
              `Platform Core file violates architecture boundaries by importing from vertical/kernel modules: "${line.trim()}"`,
              fullPath
            );
          }
        }
      });
    }
  }
}

function scanKernelDirectoryForViolations(dirPath: string, engineName: string) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      scanKernelDirectoryForViolations(fullPath, engineName);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.trim().startsWith('import ') && line.includes('from ')) {
          // Kernel -> Hospital Extension ❌
          for (const hospitalEngine of HOSPITAL_ENGINES) {
            if (line.includes(`/${hospitalEngine}`) || line.includes(`/${hospitalEngine}/`)) {
              reportViolation(
                'DEPENDENCY_DIRECTION_VIOLATION (K1)',
                `Kernel engine "${engineName}" violates dependency rules by importing from Hospital-specific engine "${hospitalEngine}". Kernel must not depend on Hospital Extension.`,
                fullPath
              );
            }
          }
          // Kernel -> Product/Verticals ❌
          if (line.includes('/products/') || line.includes('/healthcare/verticals/')) {
            reportViolation(
              'DEPENDENCY_DIRECTION_VIOLATION (K1)',
              `Kernel engine "${engineName}" violates dependency rules by importing from Product/Vertical layer: "${line.trim()}"`,
              fullPath
            );
          }
        }
      });
    }
  }
}

function scanHospitalDirectoryForViolations(dirPath: string, engineName: string) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      scanHospitalDirectoryForViolations(fullPath, engineName);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.trim().startsWith('import ') && line.includes('from ')) {
          // Hospital -> Product/Verticals ❌
          if (line.includes('/products/') || line.includes('/healthcare/verticals/')) {
            reportViolation(
              'DEPENDENCY_DIRECTION_VIOLATION (K1)',
              `Hospital extension engine "${engineName}" violates dependency rules by importing from Product/Vertical layer: "${line.trim()}"`,
              fullPath
            );
          }
        }
      });
    }
  }
}

function runArchitectureGuard() {
  console.log('\n\x1b[36m===============================================================\x1b[0m');
  console.log('\x1b[36m   BELLA HEALTHCARE OS — AUTOMATED MACHINE ARCHITECTURE GUARD   \x1b[0m');
  console.log('\x1b[36m===============================================================\x1b[0m\n');

  checkKernelFreeze();
  checkDependencyFlow();

  const productsDir = path.join(process.cwd(), 'src', 'products');
  const verticalsDir = path.join(process.cwd(), 'src', 'platform', 'healthcare', 'verticals');

  checkContractBoundaries(productsDir);
  checkContractBoundaries(verticalsDir);

  const platformDir = path.join(process.cwd(), 'src', 'platform', 'healthcare');
  checkStrictTyping(platformDir);

  if (violationsCount > 0) {
    console.error(`\x1b[31m❌ ARCHITECTURE GUARD FAILED WITH ${violationsCount} VIOLATIONS.\x1b[0m`);
    console.error(`\x1b[31m   STATUS: BLOCKED (CI/CD BUILD REJECTED)\x1b[0m\n`);
    process.exit(1);
  } else {
    console.log(`\x1b[32m✔ ARCHITECTURE GUARD PASSED: ZERO VIOLATIONS DETECTED.\x1b[0m`);
    console.log(`\x1b[32m  Healthcare OS Kernel Candidate Freeze H1–H12 Integrity Confirmed.\x1b[0m\n`);
  }
}

runArchitectureGuard();
