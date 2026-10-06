import fs from 'node:fs';
import path from 'node:path';

describe('login development bypass', () => {
  const repoRoot = process.cwd();

  it('keeps public users lookup behind a development-only server action', () => {
    const actionSource = fs.readFileSync(
      path.join(repoRoot, 'src/services/dev-login-actions.ts'),
      'utf8',
    );

    expect(actionSource).toContain("'use server'");
    expect(actionSource).toContain("process.env.NODE_ENV !== 'development'");
    expect(actionSource).toContain('getSupabaseAdminKey');
    expect(actionSource).toContain(".from('users')");
  });

  it('does not query public users directly from the browser login page', () => {
    const loginSource = fs.readFileSync(
      path.join(repoRoot, 'src/app/(auth)/login/page.tsx'),
      'utf8',
    );

    expect(loginSource).toContain('validateDevelopmentLoginBypassEmail');
    expect(loginSource).not.toContain(".from('users')");
  });
});
