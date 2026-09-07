/**
 * Bella Preschool — Architecture Compliance Tests
 *
 * Verifies product follows Bella architecture patterns
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

const PRODUCT_DIR = path.join(__dirname, '..');

describe('Bella Preschool Architecture', () => {
  describe('Product Structure', () => {
    it('should have manifest.ts', () => {
      const manifestPath = path.join(PRODUCT_DIR, 'manifest.ts');
      expect(fs.existsSync(manifestPath)).toBe(true);
    });

    it('should have types.ts', () => {
      const typesPath = path.join(PRODUCT_DIR, 'types.ts');
      expect(fs.existsSync(typesPath)).toBe(true);
    });

    it('should have actions directory', () => {
      const actionsDir = path.join(PRODUCT_DIR, 'actions');
      expect(fs.existsSync(actionsDir)).toBe(true);
      expect(fs.statSync(actionsDir).isDirectory()).toBe(true);
    });

    it('should have actions index.ts', () => {
      const actionsIndexPath = path.join(PRODUCT_DIR, 'actions', 'index.ts');
      expect(fs.existsSync(actionsIndexPath)).toBe(true);
    });

    it('should have __tests__ directory', () => {
      const testsDir = path.join(PRODUCT_DIR, '__tests__');
      expect(fs.existsSync(testsDir)).toBe(true);
      expect(fs.statSync(testsDir).isDirectory()).toBe(true);
    });
  });

  describe('Manifest', () => {
    it('should export bellaPreschoolManifest', async () => {
      const { bellaPreschoolManifest } = await import('../manifest');
      expect(bellaPreschoolManifest).toBeDefined();
      expect(bellaPreschoolManifest.id).toBe('bella-preschool');
      expect(bellaPreschoolManifest.name).toBe('Bella Preschool');
    });

    it('should have valid manifest structure', async () => {
      const { bellaPreschoolManifest } = await import('../manifest');
      expect(bellaPreschoolManifest).toHaveProperty('id');
      expect(bellaPreschoolManifest).toHaveProperty('name');
      expect(bellaPreschoolManifest).toHaveProperty('version');
      expect(bellaPreschoolManifest).toHaveProperty('themeKey');
      expect(bellaPreschoolManifest).toHaveProperty('capabilities');
      expect(bellaPreschoolManifest).toHaveProperty('workflows');
      expect(bellaPreschoolManifest).toHaveProperty('menus');
      
      expect(Array.isArray(bellaPreschoolManifest.capabilities)).toBe(true);
      expect(Array.isArray(bellaPreschoolManifest.workflows)).toBe(true);
      expect(Array.isArray(bellaPreschoolManifest.menus)).toBe(true);
    });
  });

  describe('Types', () => {
    it('should define types in types.ts', () => {
      const typesPath = path.join(PRODUCT_DIR, 'types.ts');
      const content = fs.readFileSync(typesPath, 'utf-8');
      
      // Check that key types are defined
      expect(content).toContain('interface ActionResult');
      expect(content).toContain('interface PreschoolStudent');
      expect(content).toContain('interface PreschoolClassroom');
      expect(content).toContain('interface PreschoolAttendance');
    });
  });

  describe('Actions', () => {
    it('should use "use server" directive', () => {
      const studentActionsPath = path.join(PRODUCT_DIR, 'actions', 'student-actions.ts');
      const content = fs.readFileSync(studentActionsPath, 'utf-8');
      expect(content).toContain("'use server'");
    });

    it('should import from Platform capabilities', () => {
      const studentActionsPath = path.join(PRODUCT_DIR, 'actions', 'student-actions.ts');
      const content = fs.readFileSync(studentActionsPath, 'utf-8');
      expect(content).toContain("from '@/lib/supabase-server'");
      expect(content).toContain("from '@/services/user-actions'");
    });

    it('should not import from frozen Kernels', () => {
      const actionFiles = fs.readdirSync(path.join(PRODUCT_DIR, 'actions'))
        .filter(f => f.endsWith('.ts') && f !== 'index.ts');
      
      actionFiles.forEach(file => {
        const content = fs.readFileSync(path.join(PRODUCT_DIR, 'actions', file), 'utf-8');
        // Should not import from Healthcare Kernel (frozen)
        expect(content).not.toContain('@/platform/healthcare');
        // Should not import from Spa Kernel (frozen)
        expect(content).not.toContain('@/platform/spa');
      });
    });
  });

  describe('Naming Conventions', () => {
    it('should use kebab-case for action files', () => {
      const actionFiles = fs.readdirSync(path.join(PRODUCT_DIR, 'actions'))
        .filter(f => f.endsWith('.ts'));
      
      actionFiles.forEach(file => {
        const basename = path.basename(file, '.ts');
        if (basename !== 'index') {
          expect(basename).toMatch(/^[a-z]+(-[a-z]+)*$/);
        }
      });
    });

    it('should use PascalCase for type names', async () => {
      const typesPath = path.join(PRODUCT_DIR, 'types.ts');
      const content = fs.readFileSync(typesPath, 'utf-8');
      
      // Check for PascalCase interfaces
      expect(content).toMatch(/interface\s+[A-Z][a-zA-Z]+/);
    });
  });
});
