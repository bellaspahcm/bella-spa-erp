import { describe, it, expect } from '@jest/globals';
import { verticalRegistry } from '@/platform/registry/vertical-registry';

describe('Bella Auto Module Isolation & Registry Tests', () => {
  describe('Test 1: Module Registry', () => {
    it('should have bella_auto registered in verticalRegistry', () => {
      expect(verticalRegistry.has('bella_auto')).toBe(true);
      const manifest = verticalRegistry.get('bella_auto');
      expect(manifest).toBeDefined();
      expect(manifest?.name).toBe('Bella Automotive Platform');
      expect(manifest?.key).toBe('bella_auto');
    });
  });

  describe('Test 2: Scoped Theme CSS Definitions', () => {
    it('should have CSS theme variables and selectors in auto-layout.css', () => {
      const fs = require('fs');
      const exists = fs.existsSync('src/app/dashboard/bella-auto/auto-layout.css');
      expect(exists).toBe(true);

      const css = fs.readFileSync('src/app/dashboard/bella-auto/auto-layout.css', 'utf-8');

      // Check for bella_auto theme scoped selectors
      expect(css).toContain('[data-auto-layout]');
      
      // Check for premium automotive theme color tokens
      expect(css).toContain('#0A1628'); // Deep Navy
      expect(css).toContain('#C0A060'); // Accent Gold
      expect(css).toContain('#8B9AAB'); // Racing Silver
    });
  });

  describe('Test 3: Architecture Drift Guard (Zero Cross-Vertical Imports)', () => {
    it('should verify bella-auto files do not import from other business verticals', () => {
      const fs = require('fs');
      const path = require('path');

      function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
        if (!fs.existsSync(dirPath)) return arrayOfFiles;
        const files = fs.readdirSync(dirPath);

        files.forEach((file: string) => {
          const fullPath = path.join(dirPath, file);
          if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
          } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            arrayOfFiles.push(fullPath);
          }
        });

        return arrayOfFiles;
      }

      const autoFiles = getAllFiles('src/modules/bella-auto');
      expect(autoFiles.length).toBeGreaterThan(0);

      for (const filePath of autoFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content).not.toContain('modules/spa');
        expect(content).not.toContain('modules/beauty-spa');
        expect(content).not.toContain('modules/real_estate');
      }
    });
  });

  describe('Test 4: UI Scoping Vocabulary Audit', () => {
    it('should verify Automotive pages use automotive terminology and avoid legacy Spa terms', () => {
      const fs = require('fs');

      const pages = [
        'src/app/dashboard/bella-auto/page.tsx',
        'src/app/dashboard/bella-auto/vehicles/page.tsx'
      ];

      for (const pagePath of pages) {
        expect(fs.existsSync(pagePath)).toBe(true);

        const content = fs.readFileSync(pagePath, 'utf-8');

        // Must contain Automotive terms
        const hasAutoTerms =
          content.includes('Xe') ||
          content.includes('VIN') ||
          content.includes('Hành trình') ||
          content.includes('Báo giá') ||
          content.includes('Showroom') ||
          content.includes('Dịch vụ');
        expect(hasAutoTerms).toBe(true);

        // Must NOT contain legacy Spa terms in Automotive UI components
        expect(content).not.toContain('Kỹ Thuật Viên');
        expect(content).not.toContain('Liệu trình');
        expect(content).not.toContain('Combo Mẹ');
      }
    });
  });
});
