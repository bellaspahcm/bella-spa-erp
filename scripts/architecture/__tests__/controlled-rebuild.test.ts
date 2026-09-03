/**
 * Controlled Rebuild Mode Tests
 * 
 * Validates that controlled-rebuild scope enforcement works correctly.
 */

import { execSync } from 'child_process';
import * as path from 'path';

const WORKSPACE_ROOT = path.resolve(__dirname, '../../..');

describe('Architecture Guard - Controlled Rebuild Mode', () => {
  
  it('should require --scope when using --mode=controlled-rebuild', () => {
    expect(() => {
      execSync('npx tsx scripts/architecture/architecture-guard.ts --mode=controlled-rebuild', {
        cwd: WORKSPACE_ROOT,
        encoding: 'utf-8',
        stdio: 'pipe'
      });
    }).toThrow();
  });

  it('should reject unknown scope', () => {
    expect(() => {
      execSync('npx tsx scripts/architecture/architecture-guard.ts --mode=controlled-rebuild --scope=invalid/scope', {
        cwd: WORKSPACE_ROOT,
        encoding: 'utf-8',
        stdio: 'pipe'
      });
    }).toThrow();
  });

  it('should accept valid logistics/domain scope', () => {
    // This should not throw if there are no git changes
    // or if all changes are within scope
    const result = execSync('npx tsx scripts/architecture/architecture-guard.ts --mode=controlled-rebuild --scope=logistics/domain', {
      cwd: WORKSPACE_ROOT,
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    
    expect(result).toContain('CONTROLLED REBUILD MODE');
    expect(result).toContain('logistics/domain');
  });

  it('should pass existing arch:guard checks in controlled-rebuild mode', () => {
    // Controlled rebuild mode should still enforce all existing checks
    const result = execSync('npx tsx scripts/architecture/architecture-guard.ts --mode=controlled-rebuild --scope=logistics/domain', {
      cwd: WORKSPACE_ROOT,
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    
    expect(result).toContain('Check 1: Frozen file integrity');
    expect(result).toContain('Check 3: Dependency boundary enforcement');
  });

});
