/**
 * Meta-Platform — Architecture Boundary & Static Analysis Test Suite
 * 
 * Verifies strict 1-way dependency rules across Common Core, Healthcare OS, and Education OS:
 * 1. Healthcare OS ↔ Education OS imports = 0
 * 2. Common Core ↔ Domain imports = 0
 * 3. Unified Bootstrap initializes Healthcare OS and Education OS side-by-side.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { bootstrapUnifiedPlatform } from '../bootstrap';

describe('Meta-Platform — Architecture Boundary Verification', () => {
  const platformRoot = path.resolve(__dirname, '..');

  function getAllTsFiles(dir: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        if (!filePath.includes('__tests__') && !file.startsWith('.')) {
          results = results.concat(getAllTsFiles(filePath));
        }
      } else if (file.endsWith('.ts') && !file.endsWith('.test.ts')) {
        results.push(filePath);
      }
    });
    return results;
  }

  it('should verify Healthcare OS has ZERO imports referencing Education OS', () => {
    const healthcareFiles = getAllTsFiles(path.join(platformRoot, 'healthcare'));
    const invalidImports: string[] = [];

    healthcareFiles.forEach((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('/education') || content.includes("from './education") || content.includes('from "../education')) {
        invalidImports.push(path.basename(file));
      }
    });

    expect(invalidImports).toEqual([]);
  });

  it('should verify Education OS has ZERO imports referencing Healthcare OS', () => {
    const educationFiles = getAllTsFiles(path.join(platformRoot, 'education'));
    const invalidImports: string[] = [];

    educationFiles.forEach((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('/healthcare') || content.includes("from './healthcare") || content.includes('from "../healthcare')) {
        invalidImports.push(path.basename(file));
      }
    });

    expect(invalidImports).toEqual([]);
  });

  it('should verify Common Core has ZERO imports referencing Healthcare or Education domains', () => {
    const coreFiles = getAllTsFiles(path.join(platformRoot, 'core'));
    const invalidImports: string[] = [];

    coreFiles.forEach((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      if (
        content.includes('/healthcare') ||
        content.includes('/education') ||
        content.includes('/host') ||
        content.includes("from '../healthcare") ||
        content.includes("from '../education")
      ) {
        invalidImports.push(path.basename(file));
      }
    });

    expect(invalidImports).toEqual([]);
  });

  it('should bootstrap Healthcare OS and Education OS side-by-side cleanly on unified platform bootstrapper', async () => {
    const dummySupabase = createClient('https://example.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy');
    
    const container = await bootstrapUnifiedPlatform({ supabaseClient: dummySupabase });

    expect(container.contractRegistry.hasContract('education-engine')).toBe(true);
    expect(container.educationService).toBeDefined();
  });
});
