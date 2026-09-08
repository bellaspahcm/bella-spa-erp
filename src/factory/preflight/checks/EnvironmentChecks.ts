/**
 * Factory Preflight Guard — Environment Checks
 * 
 * Purpose: Verify required environment variables and configuration before testing
 */

import type { PreflightCheck, PreflightResult, EnvironmentVariable } from '../types';

export class EnvironmentChecks {
  /**
   * Check if required environment variables are present
   */
  createEnvVarsCheck(vars: EnvironmentVariable[]): PreflightCheck {
    return {
      id: 'env-vars',
      name: 'Environment Variables',
      category: 'environment',
      required: true,
      check: async (): Promise<PreflightResult> => {
        const timestamp = new Date().toISOString();

        const missing: string[] = [];
        const present: string[] = [];

        for (const envVar of vars) {
          const value = process.env[envVar.name];
          
          if (!value || value.trim() === '') {
            if (envVar.required) {
              missing.push(envVar.name);
            }
          } else {
            present.push(envVar.name);
          }
        }

        if (missing.length > 0) {
          return {
            passed: false,
            status: 'FAIL',
            message: `Missing required environment variables (${missing.length})`,
            evidence: missing.join(', '),
            suggestion: `Set the following variables in .env.local:\n${missing.map(v => `${v}=<value>`).join('\n')}`,
            timestamp,
          };
        }

        return {
          passed: true,
          status: 'PASS',
          message: `All environment variables present (${present.length})`,
          timestamp,
        };
      },
    };
  }

  /**
   * Check Node.js version compatibility
   */
  createNodeVersionCheck(minVersion: string = '18.0.0'): PreflightCheck {
    return {
      id: 'node-version',
      name: 'Node.js Version',
      category: 'environment',
      required: false,
      check: async (): Promise<PreflightResult> => {
        const timestamp = new Date().toISOString();

        const currentVersion = process.version.replace('v', '');
        const [currentMajor, currentMinor, currentPatch] = currentVersion
          .split('.')
          .map(Number);
        const [minMajor, minMinor, minPatch] = minVersion.split('.').map(Number);

        const isCompatible =
          currentMajor > minMajor ||
          (currentMajor === minMajor && currentMinor > minMinor) ||
          (currentMajor === minMajor &&
            currentMinor === minMinor &&
            currentPatch >= minPatch);

        if (!isCompatible) {
          return {
            passed: false,
            status: 'WARN',
            message: `Node.js version below recommended (${currentVersion} < ${minVersion})`,
            evidence: `Current: ${currentVersion}, Required: ${minVersion}`,
            suggestion: `Upgrade Node.js to version ${minVersion} or higher`,
            timestamp,
          };
        }

        return {
          passed: true,
          status: 'PASS',
          message: `Node.js version compatible (${currentVersion})`,
          timestamp,
        };
      },
    };
  }

  /**
   * Check if required npm packages are installed
   */
  createPackageCheck(packages: string[]): PreflightCheck {
    return {
      id: 'npm-packages',
      name: 'NPM Packages',
      category: 'environment',
      required: false,
      check: async (): Promise<PreflightResult> => {
        const timestamp = new Date().toISOString();

        const missing: string[] = [];

        for (const pkg of packages) {
          try {
            require.resolve(pkg);
          } catch {
            missing.push(pkg);
          }
        }

        if (missing.length > 0) {
          return {
            passed: false,
            status: 'WARN',
            message: `Missing optional packages (${missing.length})`,
            evidence: missing.join(', '),
            suggestion: `Install missing packages:\nnpm install ${missing.join(' ')}`,
            timestamp,
          };
        }

        return {
          passed: true,
          status: 'PASS',
          message: `All packages available (${packages.length})`,
          timestamp,
        };
      },
    };
  }
}
