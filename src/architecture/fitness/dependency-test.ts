import fs from 'fs';
import path from 'path';

/**
 * BELLA EIP Architecture Fitness Test Suite (CI Automation)
 * Enforces Constitutional Principles 13, 14 (Dependency Invariants)
 */

const SRC_DIR = path.resolve(process.cwd(), 'src');
const PLATFORM_DIR = path.join(SRC_DIR, 'platform');
const MODULES_DIR = path.join(SRC_DIR, 'modules');
const PLUGINS_DIR = path.join(SRC_DIR, 'plugins');

interface FitnessViolation {
  file: string;
  line: number;
  rule: string;
  importPath: string;
}

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

export function runArchitectureFitnessTests(): { passed: boolean; violations: FitnessViolation[] } {
  const violations: FitnessViolation[] = [];

  // Rule 1: Platform MUST NOT import any Module
  const platformFiles = getAllFiles(PLATFORM_DIR);
  for (const file of platformFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (line.match(/from\s+['"].*\/modules\//) || line.match(/import\(.*\/modules\//)) {
        violations.push({
          file: path.relative(SRC_DIR, file),
          line: index + 1,
          rule: 'Principle 14: Platform Core MUST NOT import or depend on any Module directly',
          importPath: line.trim(),
        });
      }
    });
  }

  // Rule 2: Plugins MUST NOT import any Module
  const pluginFiles = getAllFiles(PLUGINS_DIR);
  for (const file of pluginFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (line.match(/from\s+['"].*\/modules\//) || line.match(/import\(.*\/modules\//)) {
        violations.push({
          file: path.relative(SRC_DIR, file),
          line: index + 1,
          rule: 'Principle 14: Plugins MUST NOT import or depend on any Module directly',
          importPath: line.trim(),
        });
      }
    });
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

const result = runArchitectureFitnessTests();
if (result.passed) {
  console.log('✅ BELLA EIP Architecture Fitness Tests PASSED: 0 Violations Found.');
  process.exit(0);
} else {
  console.error(`❌ BELLA EIP Architecture Fitness Tests FAILED: ${result.violations.length} Violations Found:`);
  result.violations.forEach((v) => {
    console.error(`   [${v.file}:${v.line}] ${v.rule} -> "${v.importPath}"`);
  });
  process.exit(1);
}
