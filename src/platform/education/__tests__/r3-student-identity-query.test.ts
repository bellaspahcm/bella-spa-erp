import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('R3 Student identity query semantics', () => {
  it('resolves studentPartyId through students.party_id, not legacy person_id', () => {
    const repositoryPath = join(
      process.cwd(),
      'src/platform/education/repositories/supabase-education.repository.ts'
    );
    const source = readFileSync(repositoryPath, 'utf8');
    const methodSource = source.slice(
      source.indexOf('public async getStudentScores'),
      source.indexOf('public async getActiveEnrollmentsCount')
    );

    expect(methodSource).toContain(".eq('party_id', studentPartyId)");
    expect(methodSource).not.toContain(".eq('person_id', studentPartyId)");
  });

  it('does not use the legacy resolver or identity mapping for canonical Student create', () => {
    const servicePath = join(process.cwd(), 'src/platform/education/student/student.service.ts');
    const repositoryPath = join(process.cwd(), 'src/platform/education/student/student.repository.ts');
    const serviceSource = readFileSync(servicePath, 'utf8');
    const repositorySource = readFileSync(repositoryPath, 'utf8');

    expect(serviceSource).not.toContain('resolve_student_person_id');
    expect(serviceSource).not.toContain('identity_migration_mapping');
    expect(repositorySource).not.toContain('identity_migration_mapping');
  });
});
