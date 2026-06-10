import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

const projectRoot = process.cwd();
const sourceRoots = ['src', 'scripts'];
const excludedDirs = new Set(['.git', '.next', '__mocks__', '__tests__', 'node_modules']);
const approvedDirectLedgerWriters = new Set([
  'src/services/accounting-engine.ts',
]);

function journalWritePattern() {
  return /\.from\s*\(\s*['"]journal_(?:entries|lines)['"]\s*\)[\s\S]{0,400}\.(?:insert|upsert|update|delete)\s*\(/g;
}

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      if (excludedDirs.has(entry)) return [];
      return listSourceFiles(fullPath);
    }

    return /\.(cjs|mjs|js|ts|tsx)$/.test(entry) ? [fullPath] : [];
  });
}

function toRepoPath(filePath: string) {
  return relative(projectRoot, filePath).split(sep).join('/');
}

function lineNumberFor(source: string, index: number) {
  return source.slice(0, index).split(/\r?\n/).length;
}

describe('accounting ledger boundary', () => {
  it('keeps direct journal writes inside the accounting engine', () => {
    const offenders = sourceRoots
      .flatMap((root) => listSourceFiles(join(projectRoot, root)))
      .flatMap((filePath) => {
        const repoPath = toRepoPath(filePath);
        if (approvedDirectLedgerWriters.has(repoPath)) return [];

        const source = readFileSync(filePath, 'utf8');
        return Array.from(source.matchAll(journalWritePattern())).map((match) => (
          `${repoPath}:${lineNumberFor(source, match.index ?? 0)}`
        ));
      });

    expect(offenders).toEqual([]);
  });

  it('documents the approved direct journal writer', () => {
    const enginePath = join(projectRoot, 'src/services/accounting-engine.ts');
    const engineSource = readFileSync(enginePath, 'utf8');

    expect(engineSource.match(journalWritePattern())?.length).toBeGreaterThanOrEqual(3);
  });
});
