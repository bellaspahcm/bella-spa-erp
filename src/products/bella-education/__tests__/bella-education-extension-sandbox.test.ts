/**
 * BELLA EDUCATION — STATIC EXTENSION SANDBOX GUARD
 *
 * Verifies sandbox integrity rules at compile-time:
 * - Extension files must not directly import database clients (@supabase/supabase-js).
 * - Extension files must not directly import internal repository files or core engines.
 * - Extension files must not import fs modules.
 *
 * @module src/products/bella-education/__tests__/bella-education-extension-sandbox.test
 */

import * as fs from 'fs';
import * as path from 'path';

const PLATFORM_EXTENSIONS_DIR = path.resolve(__dirname, '../../../platform/extensions');

function getAllTsFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllTsFiles(filePath));
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      results.push(filePath);
    }
  });
  return results;
}

describe('Bella Education V1 — Static Extension Sandbox Guard', () => {
  const extensionSourceFiles = getAllTsFiles(PLATFORM_EXTENSIONS_DIR);

  it('Rule C: Extension Sandbox integrity checks (only public contract imports allowed)', () => {
    const violations: string[] = [];

    extensionSourceFiles.forEach((file) => {
      // Skip the contracts definitions and registry orchestrators themselves
      const filename = path.basename(file);
      if (filename.includes('contract') || filename.includes('runtime')) {
        return;
      }

      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

        // 1. Prohibit database client imports (@supabase/supabase-js)
        const dbPattern = /import\s+.*\s+from\s+['"].*(@supabase\/supabase-js|supabase-server|supabase-client).*['"]/;
        if (dbPattern.test(line)) {
          violations.push(
            `${path.relative(PLATFORM_EXTENSIONS_DIR, file)}:L${index + 1} - Database client import detected: '${line.trim()}'. Extensions are strictly prohibited from querying the database directly.`
          );
        }

        // 2. Prohibit direct internal repositories and engines imports
        const internalPattern = /import\s+.*\s+from\s+['"].*platform\/(education|accounting)\/(engines|repositories|domain).*['"]/;
        if (internalPattern.test(line)) {
          violations.push(
            `${path.relative(PLATFORM_EXTENSIONS_DIR, file)}:L${index + 1} - Internal repository or engine import detected: '${line.trim()}'. Extensions must only consume Approved Contracts.`
          );
        }

        // 3. Prohibit direct filesystem module imports
        const fsPattern = /import\s+.*\s+from\s+['"](fs|path)['"]/;
        if (fsPattern.test(line)) {
          violations.push(
            `${path.relative(PLATFORM_EXTENSIONS_DIR, file)}:L${index + 1} - Filesystem import detected: '${line.trim()}'. Extensions are strictly blocked from local file system access.`
          );
        }
      });
    });

    expect(violations).toEqual([]);
  });
});
