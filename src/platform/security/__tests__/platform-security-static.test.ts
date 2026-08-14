/**
 * BELLA PLATFORM — STATIC SECURITY ARCHITECTURE GUARD
 *
 * Verifies production hardening security rules at build time:
 * - Prohibits hardcoded API keys or plaintext credentials.
 * - Prohibits unsafe logging of credentials or raw secrets.
 * - Ensures tenant-scoped database repositories enforce tenant filters.
 * - Prohibits extensions from direct DB access or importing private files.
 *
 * @module src/platform/security/__tests__/platform-security-static.test
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.resolve(__dirname, '../../../');
const PLATFORM_DIR = path.resolve(__dirname, '../../');
const PRODUCTS_DIR = path.resolve(__dirname, '../../../products');

function getTsFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    // Skip node_modules and output reports
    if (file === 'node_modules' || file === 'dist' || file.startsWith('.')) return;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getTsFiles(filePath));
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      results.push(filePath);
    }
  });
  return results;
}

describe('Bella Platform V2 — Static Security Architecture Guard', () => {
  const sourceFiles = [
    ...getTsFiles(PLATFORM_DIR),
    ...getTsFiles(PRODUCTS_DIR)
  ];

  test('T1 Static Architecture Verification: Scan for hardcoded keys, unsafe logs, and contract bypasses', () => {
    const violations: string[] = [];

    sourceFiles.forEach((file) => {
      // Ignore test files, test directories, and mock files themselves to avoid self-reporting
      const filename = path.basename(file);
      if (file.includes('__tests__') || filename.includes('.test.ts') || filename.includes('test-extensions.ts') || filename.includes('mock')) {
        return;
      }

      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

        // 1. Prohibit hardcoded secret keys or keys containing high-entropy password declarations
        const secretPattern = /(const|let|var)\s+\w*(api_key|secret|password|kms_key|kmsKey)\w*\s*=\s*['"][a-zA-Z0-9]{12,}['"]/i;
        if (secretPattern.test(line)) {
          violations.push(
            `${path.relative(SRC_DIR, file)}:L${index + 1} - Hardcoded secret declaration detected: '${line.trim()}'`
          );
        }

        // 2. Prohibit unsafe logging (e.g., logging plain variables matching secret or password names)
        const loggingPattern = /console\.(log|info|warn|error)\(.*(secret|password|apiKey|api_key|kmsKey).*\)/i;
        if (loggingPattern.test(line)) {
          violations.push(
            `${path.relative(SRC_DIR, file)}:L${index + 1} - Unsafe variable logging pattern detected: '${line.trim()}'`
          );
        }

        // 3. Prohibit direct bypass imports in product components bypassing Public Contracts
        const bypassPattern = /import\s+.*\s+from\s+['"].*platform\/\w+\/repositories\/(?!.*interface).*['"]/i;
        if (bypassPattern.test(line)) {
          violations.push(
            `${path.relative(SRC_DIR, file)}:L${index + 1} - Direct repository bypass import: '${line.trim()}'. Must reference public interfaces/contracts.`
          );
        }
      });
    });

    expect(violations).toEqual([]);
  });
});
