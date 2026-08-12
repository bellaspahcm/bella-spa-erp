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

// Known engines with historical exemptions
const KNOWN_EXEMPTIONS: Record<string, string[]> = {
  'encounter-engine': ['contracts', 'events', 'repositories'], // Uses infrastructure/ folder
  'bed-engine': ['contracts'],
  'nursing-engine': ['events'],
  'cds-engine': ['domain', 'contracts', 'events', 'repositories'], // Stateless calculation engine
  'surgical-engine': ['contracts', 'events'],
  'emergency-engine': ['events'],
  'anesthesia-engine': ['domain', 'contracts', 'events', 'repositories'],
  'blood-bank-engine': ['domain', 'contracts', 'events', 'repositories'],
  'cssd-engine': ['domain', 'contracts', 'events', 'repositories'],
  'or-engine': ['domain', 'contracts', 'events', 'repositories'],
  'or-readiness-engine': ['domain', 'contracts', 'events', 'repositories'],
  'pacu-engine': ['domain', 'contracts', 'events', 'repositories'],
  'scheduling-engine': ['domain', 'contracts', 'events', 'repositories'],
  'queue-engine': ['domain', 'contracts', 'events', 'repositories'],
};

const ENGINES_ROOT = path.resolve(__dirname, '../engines');

// Dynamically discover all engines on disk to enforce zero-leakage constraints automatically
const ALL_ENGINES = fs.readdirSync(ENGINES_ROOT).filter((f) => 
  fs.statSync(path.join(ENGINES_ROOT, f)).isDirectory()
);

// Active engines are those with service implementations or explicit registrations
const ACTIVE_ENGINES = ALL_ENGINES.filter((engineName) => {
  const engineDir = path.join(ENGINES_ROOT, engineName);
  const files = fs.readdirSync(engineDir);
  const hasServiceFile = files.some((f) => f.endsWith('.service.ts'));
  return hasServiceFile || engineName === 'encounter-engine';
});

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
    it('Law 1: All engines MUST have ZERO direct imports of domain/repositories from other engines', () => {
      const crossDomainViolations: Array<{ engine: string; file: string; invalidImport: string }> = [];

      ALL_ENGINES.forEach((engineName) => {
        const engineDir = path.join(ENGINES_ROOT, engineName);
        const files = getAllTsFiles(engineDir);

        files.forEach((filePath) => {
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n');

          lines.forEach((line, lineIdx) => {
            if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

            // Check if importing from another engine's domain or repository directly
            ALL_ENGINES.forEach((otherEngineName) => {
              if (otherEngineName === engineName) return;

              const domainPattern = new RegExp(`from ['"].*${otherEngineName}/domain/.*['"]`);
              const repoPattern = new RegExp(`from ['"].*${otherEngineName}/repositories/.*['"]`);

              if (domainPattern.test(line) || repoPattern.test(line)) {
                crossDomainViolations.push({
                  engine: engineName,
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

    it('Law 11: All engine production source files MUST have ZERO `: any` or `as any` type usage', () => {
      const anyTypeViolations: Array<{ file: string; line: number; content: string }> = [];

      ALL_ENGINES.forEach((engineName) => {
        const engineDir = path.join(ENGINES_ROOT, engineName);
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
    it('11-Step Pattern: All active engines MUST conform to required directory structure or declare valid exemptions', () => {
      const missingStructures: Array<{ engine: string; missing: string }> = [];

      ACTIVE_ENGINES.forEach((engineName) => {
        const engineDir = path.join(ENGINES_ROOT, engineName);
        expect(fs.existsSync(engineDir)).toBe(true);

        const requiredComponents = [
          { key: 'domain', path: path.join(engineDir, 'domain'), isDir: true },
          { key: 'contracts', path: path.join(engineDir, 'contracts'), isDir: true },
          { key: 'events', path: path.join(engineDir, 'events'), isDir: true },
          { key: 'repositories', path: path.join(engineDir, 'repositories'), isDir: true },
        ];

        const exemptions = KNOWN_EXEMPTIONS[engineName] || [];

        requiredComponents.forEach((comp) => {
          if (exemptions.includes(comp.key)) return; // Declared exemption

          if (!fs.existsSync(comp.path)) {
            missingStructures.push({
              engine: engineName,
              missing: `Missing directory: ${comp.key}/`,
            });
          }
        });
      });

      expect(missingStructures).toEqual([]);
    });
  });

  describe('Architecture Fitness Tests (Constitution v4 Hardening)', () => {
    it('Encounter Freeze: The shared Encounter model must not be bloated with domain-specific properties', () => {
      const typesFilePath = path.resolve(__dirname, '../shared-kernel/types.ts');
      const content = fs.readFileSync(typesFilePath, 'utf-8');
      
      const encounterMatch = content.match(/export interface Encounter \{([\s\S]*?)\n\}/);
      expect(encounterMatch).not.toBeNull();
      
      const propertiesBlock = encounterMatch![1];
      const properties = propertiesBlock
        .split('\n')
        .map((line) => line.trimEnd())
        // filter out comments
        .filter((line) => line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('/*') && !line.trim().startsWith('*'))
        // filter for exactly 2 spaces indentation to capture top-level properties
        .filter((line) => /^\s{2}[a-zA-Z0-9]/.test(line))
        // split properties before the colon/question mark
        .map((line) => line.trim().split('?')[0].split(':')[0].trim());
      
      const EXPECTED_PROPERTIES = [
        'id',
        'tenantId',
        'patientId',
        'encounterType',
        'encounterClass',
        'status',
        'period',
        'serviceProviderId',
        'departmentId',
        'locationId',
        'reasonCode',
        'diagnosis',
        'createdAt',
        'updatedAt',
      ];
      
      expect(properties.sort()).toEqual(EXPECTED_PROPERTIES.sort());
    });

    it('Event-After-Persistence Invariant: eventBus.publish must occur strictly after database write operations in service methods', () => {
      const violations: string[] = [];

      ALL_ENGINES.forEach((engineName) => {
        const engineDir = path.join(ENGINES_ROOT, engineName);
        const files = getAllTsFiles(engineDir).filter((f) => f.endsWith('.service.ts'));

        files.forEach((filePath) => {
          const content = fs.readFileSync(filePath, 'utf-8');
          
          // Split file by async methods to analyze method bodies
          const methods = content.split(/\basync\s+/);
          methods.shift(); // Remove content before first async method

          methods.forEach((methodBody, idx) => {
            const publishIndex = methodBody.indexOf('eventBus.publish(');
            if (publishIndex !== -1) {
              // Extract write operation indices
              const saveIndex = methodBody.indexOf('.save(');
              const insertIndex = methodBody.indexOf('.insert(');
              const updateIndex = methodBody.indexOf('.update(');
              const deleteIndex = methodBody.indexOf('.delete(');

              const dbWriteIndexes = [saveIndex, insertIndex, updateIndex, deleteIndex].filter((i) => i !== -1);
              if (dbWriteIndexes.length > 0) {
                const earliestDbWrite = Math.min(...dbWriteIndexes);
                if (earliestDbWrite > publishIndex) {
                  violations.push(
                    `${path.relative(ENGINES_ROOT, filePath)} (method #${idx + 1}): eventBus.publish is called before database write`
                  );
                }
              }
            }
          });
        });
      });

      expect(violations).toEqual([]);
    });
  });
});
