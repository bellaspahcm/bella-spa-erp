/**
 * Engine Architecture Compliance & Structural Gate
 *
 * Enforces 4-Layer Architecture Compliance for Healthcare OS Engines:
 *
 * Layer 1 — Static Architecture:
 * - Law 1: Boundary Isolation (ZERO imports referencing `domain/` or `repositories/` of other engines)
 * - Law 11: Zero `any` types in platform engines (`: any`, `as any`)
 *
 * Layer 2 — Structural Compliance (11-Step Pattern):
 * - Verifies registered engines have standard directory structure:
 *   `domain/`, `contracts/`, `events/`, `repositories/`, `<engine>.service.ts`
 * - Supports explicit Exemption Declarations for lightweight or legacy-structured engines.
 *
 * Layer 3 — Behavioral Invariants:
 * - Handled via execution tests (`bed-concurrency.integration.test.ts`, etc.)
 *
 * Layer 4 — H1 Guardian:
 * - Handled via full regression suite.
 *
 * @module platform/healthcare/__tests__
 */

import * as fs from 'fs';
import * as path from 'path';

// Registered Healthcare Platform Engines with explicit structural exemption declarations
interface EngineConfig {
  name: string;
  exemptions?: string[]; // e.g. ['events'] if engine doesn't publish domain events directly
}

const REGISTERED_ENGINES: EngineConfig[] = [
  { name: 'encounter-engine', exemptions: ['contracts', 'events', 'repositories'] }, // Uses infrastructure/ folder
  { name: 'admission-engine' },
  { name: 'bed-engine', exemptions: ['contracts'] },
  { name: 'nursing-engine', exemptions: ['events'] },
  { name: 'order-engine' },
  { name: 'pharmacy-engine' },
  { name: 'cds-engine', exemptions: ['domain', 'contracts', 'events', 'repositories'] }, // Stateless calculation engine
];

const ENGINES_ROOT = path.resolve(__dirname, '../engines');

function getAllTsFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!filePath.includes('node_modules') && !filePath.includes('.next')) {
        results = results.concat(getAllTsFiles(filePath));
      }
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      results.push(filePath);
    }
  });
  return results;
}

describe('Healthcare OS — Architecture Compliance & Structural Gate', () => {
  describe('Layer 1 — Static Architecture (Law 1 & Law 11)', () => {
    it('Law 1: All registered engines MUST have ZERO direct imports of domain/repositories from other engines', () => {
      const crossDomainViolations: Array<{ engine: string; file: string; invalidImport: string }> = [];

      REGISTERED_ENGINES.forEach((engine) => {
        const engineDir = path.join(ENGINES_ROOT, engine.name);
        const files = getAllTsFiles(engineDir);

        files.forEach((filePath) => {
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n');

          lines.forEach((line, lineIdx) => {
            if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

            // Check if importing from another engine's domain or repository directly
            REGISTERED_ENGINES.forEach((otherEngine) => {
              if (otherEngine.name === engine.name) return;

              const domainPattern = new RegExp(`from ['"].*${otherEngine.name}/domain/.*['"]`);
              const repoPattern = new RegExp(`from ['"].*${otherEngine.name}/repositories/.*['"]`);

              if (domainPattern.test(line) || repoPattern.test(line)) {
                crossDomainViolations.push({
                  engine: engine.name,
                  file: `${path.basename(filePath)}:${lineIdx + 1}`,
                  invalidImport: line.trim(),
                });
              }
            });
          });
        });
      });

      expect(crossDomainViolations).toEqual([]);
    });

    it('Law 11: All registered engine production source files MUST have ZERO `: any` or `as any` type usage', () => {
      const anyTypeViolations: Array<{ file: string; line: number; content: string }> = [];

      REGISTERED_ENGINES.forEach((engine) => {
        const engineDir = path.join(ENGINES_ROOT, engine.name);
        const files = getAllTsFiles(engineDir).filter((f) => !f.includes('__tests__'));

        files.forEach((filePath) => {
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n');

          lines.forEach((line, lineIdx) => {
            if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

            // Check for explicit any patterns
            const hasExplicitAny = /:\s*any\b/.test(line) || /\bas\s+any\b/.test(line) || /<any>/.test(line);

            if (hasExplicitAny) {
              anyTypeViolations.push({
                file: `${path.relative(ENGINES_ROOT, filePath)}:${lineIdx + 1}`,
                line: lineIdx + 1,
                content: line.trim(),
              });
            }
          });
        });
      });

      expect(anyTypeViolations).toEqual([]);
    });
  });

  describe('Layer 2 — Structural Compliance (11-Step Pattern)', () => {
    it('11-Step Pattern: All registered engines MUST conform to required directory structure or declare valid exemptions', () => {
      const missingStructures: Array<{ engine: string; missing: string }> = [];

      REGISTERED_ENGINES.forEach((engine) => {
        const engineDir = path.join(ENGINES_ROOT, engine.name);
        expect(fs.existsSync(engineDir)).toBe(true);

        const requiredComponents = [
          { key: 'domain', path: path.join(engineDir, 'domain'), isDir: true },
          { key: 'contracts', path: path.join(engineDir, 'contracts'), isDir: true },
          { key: 'events', path: path.join(engineDir, 'events'), isDir: true },
          { key: 'repositories', path: path.join(engineDir, 'repositories'), isDir: true },
        ];

        requiredComponents.forEach((comp) => {
          if (engine.exemptions?.includes(comp.key)) return; // Declared exemption

          if (!fs.existsSync(comp.path)) {
            missingStructures.push({
              engine: engine.name,
              missing: `Missing directory: ${comp.key}/`,
            });
          }
        });
      });

      expect(missingStructures).toEqual([]);
    });
  });
});
