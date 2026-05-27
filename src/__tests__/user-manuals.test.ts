import { isManualPermitted } from '@/services/user-manuals-utils';

describe('User Manuals Access Control Permissions', () => {
  // 1. SOP & Index are globally readable
  describe('Publicly Accessible Manuals (SOP & Index)', () => {
    const publicSlugs = ['sop', 'index', 'SOP', 'INDEX'];

    it('allows anyone authenticated to read SOP and Index, regardless of role', () => {
      const roles = ['admin', 'ktv', 'ktv_lead', 'hr', 'accountant', 'admin_staff', 'user'];

      publicSlugs.forEach((slug) => {
        roles.forEach((role) => {
          expect(isManualPermitted(role, slug)).toBe(true);
        });
      });
    });

    it('rejects access if role is null or undefined', () => {
      publicSlugs.forEach((slug) => {
        expect(isManualPermitted(null, slug)).toBe(false);
        expect(isManualPermitted(undefined, slug)).toBe(false);
        expect(isManualPermitted('', slug)).toBe(false);
      });
    });
  });

  // 2. Admin role has absolute access
  describe('Admin Role Access Rights', () => {
    it('allows admin absolute access to all user manual slugs', () => {
      const allSlugs = ['admin', 'accountant', 'hr', 'ktv', 'sop', 'index', 'random-slug'];
      
      allSlugs.forEach((slug) => {
        expect(isManualPermitted('admin', slug)).toBe(true);
        expect(isManualPermitted('ADMIN', slug)).toBe(true);
      });
    });
  });

  // 3. Role-specific restrictions (KTV, HR, Accountant, Staff)
  describe('Role-Specific Restrictive Access Control', () => {
    
    // KTV role permissions
    describe('KTV & KTV Lead Roles', () => {
      it('allows KTV to read ktv, sop, and index guides', () => {
        expect(isManualPermitted('ktv', 'ktv')).toBe(true);
        expect(isManualPermitted('ktv_lead', 'ktv')).toBe(true);
        expect(isManualPermitted('ktv', 'sop')).toBe(true);
      });

      it('strictly denies KTV from accessing admin, accountant, and hr guides', () => {
        expect(isManualPermitted('ktv', 'admin')).toBe(false);
        expect(isManualPermitted('ktv', 'accountant')).toBe(false);
        expect(isManualPermitted('ktv', 'hr')).toBe(false);
        expect(isManualPermitted('ktv_lead', 'admin')).toBe(false);
      });
    });

    // HR role permissions
    describe('HR Role', () => {
      it('allows HR to read hr, ktv, sop, and index guides', () => {
        expect(isManualPermitted('hr', 'hr')).toBe(true);
        expect(isManualPermitted('hr', 'ktv')).toBe(true);
        expect(isManualPermitted('hr', 'sop')).toBe(true);
      });

      it('strictly denies HR from accessing admin and accountant guides', () => {
        expect(isManualPermitted('hr', 'admin')).toBe(false);
        expect(isManualPermitted('hr', 'accountant')).toBe(false);
      });
    });

    // Accountant role permissions
    describe('Accountant Role', () => {
      it('allows accountant to read accountant, sop, and index guides', () => {
        expect(isManualPermitted('accountant', 'accountant')).toBe(true);
        expect(isManualPermitted('accountant', 'sop')).toBe(true);
      });

      it('strictly denies accountant from accessing admin, hr, and ktv guides', () => {
        expect(isManualPermitted('accountant', 'admin')).toBe(false);
        expect(isManualPermitted('accountant', 'hr')).toBe(false);
        expect(isManualPermitted('accountant', 'ktv')).toBe(false);
      });
    });

    // Receptionist / Front Desk (admin_staff) permissions
    describe('Front Desk Reception (admin_staff) Role', () => {
      it('allows admin_staff to read sop and index guides only', () => {
        expect(isManualPermitted('admin_staff', 'sop')).toBe(true);
        expect(isManualPermitted('admin_staff', 'index')).toBe(true);
      });

      it('strictly denies admin_staff from accessing role-specific guides', () => {
        expect(isManualPermitted('admin_staff', 'admin')).toBe(false);
        expect(isManualPermitted('admin_staff', 'accountant')).toBe(false);
        expect(isManualPermitted('admin_staff', 'hr')).toBe(false);
        expect(isManualPermitted('admin_staff', 'ktv')).toBe(false);
      });
    });
  });

  // 4. Edge cases
  describe('Edge Cases & Sanitization', () => {
    it('handles case-insensitivity of roles and slugs properly', () => {
      expect(isManualPermitted('AcCoUnTaNt', 'AcCoUnTaNt')).toBe(true);
      expect(isManualPermitted('hR', 'kTv')).toBe(true);
      expect(isManualPermitted('AdMiN', 'AnY-SlUg')).toBe(true);
    });

    it('denies access for completely invalid or non-existent slugs', () => {
      expect(isManualPermitted('ktv', 'non-existent-manual-slug')).toBe(false);
      expect(isManualPermitted('hr', 'some-other-invalid-slug')).toBe(false);
    });
  });
});
