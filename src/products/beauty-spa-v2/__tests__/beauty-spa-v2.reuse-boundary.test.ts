import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();

function readRepoFile(repoRelativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, repoRelativePath), 'utf-8');
}

describe('Bella Beauty Spa v2 Beauty OS reuse boundary', () => {
  it('reuses Beauty OS public services and contracts instead of forking product logic', () => {
    const serviceSource = readRepoFile('src/products/beauty-spa-v2/service.ts');

    expect(serviceSource).toContain("from '../../platform/beauty/application/services'");
    expect(serviceSource).toContain("from '../../platform/beauty/application/ports'");
    expect(serviceSource).toContain("from '../../platform/beauty/contracts'");
    expect(serviceSource).toContain('AppointmentService');
    expect(serviceSource).toContain('ProfessionalAssignmentService');
    expect(serviceSource).toContain('ResourceAllocationService');
    expect(serviceSource).toContain('SessionTrackingService');
  });

  it('does not bypass Beauty OS through direct database, legacy module, or sibling product dependencies', () => {
    const sourceFiles = [
      'src/products/beauty-spa-v2/service.ts',
      'src/products/beauty-spa-v2/index.ts',
      'src/app/dashboard/beauty-spa-v2/page.tsx',
    ].map(readRepoFile);
    const combinedSource = sourceFiles.join('\n');

    expect(combinedSource).not.toMatch(/from ['"]@\/modules\/spa/);
    expect(combinedSource).not.toMatch(/from ['"]@\/products\/nail/);
    expect(combinedSource).not.toMatch(/from ['"]@\/app\/dashboard\/nail/);
    expect(combinedSource).not.toMatch(/from ['"]@\/lib\/supabase/);
    expect(combinedSource).not.toMatch(/from ['"]@\/types\/database\.types/);
    expect(combinedSource).not.toMatch(/createClient\(/);
    expect(combinedSource).not.toMatch(/\.from\(['"]beauty_/);
  });
});
