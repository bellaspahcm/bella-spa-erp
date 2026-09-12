/**
 * Person Write Guard
 * 
 * R5.1B Enforcement: Block new Education/Product code from using Person write APIs.
 * Legacy test fixtures allowed temporarily (migration path: R6).
 * 
 * See: E0.1A-R Identity Remediation (R5 freeze 2026-09-12)
 */

export class PersonWriteGuard {
  /**
   * Validate caller can write to Person
   * @throws ArchitectureViolation if caller prohibited
   */
  static validate(callerPath: string, operation: 'create' | 'update' | 'delete'): void {
    // Block new Education production code
    if (this.isProductionCode(callerPath) && this.isEducationDomain(callerPath)) {
      throw new ArchitectureViolation(
        `Person write (${operation}) prohibited in Education production code. ` +
        `Use Party canonical identity. ` +
        `Caller: ${callerPath}. ` +
        `See: E0.1A-R Identity Remediation (R5 freeze 2026-09-12)`
      );
    }

    // Block new Product code
    if (this.isProductionCode(callerPath) && this.isProductDomain(callerPath)) {
      throw new ArchitectureViolation(
        `Person write (${operation}) prohibited in new Product code. ` +
        `Use Party canonical identity. ` +
        `Caller: ${callerPath}. ` +
        `See: E0.1A-R Identity Remediation (R5 freeze 2026-09-12)`
      );
    }

    // Allow legacy test fixtures (temporary - R6 migration)
    if (this.isTestCode(callerPath)) {
      console.warn(
        `[LEGACY TEST FIXTURE] ${callerPath} uses Person.${operation}(). ` +
        `Migration to Party planned for R6.`
      );
      return; // Allow but warn
    }

    // Allow remediation scripts
    if (this.isRemediationScript(callerPath)) {
      console.log(`[REMEDIATION] ${callerPath} uses Person.${operation}() - approved legacy path`);
      return;
    }
  }

  private static isProductionCode(path: string): boolean {
    return !path.includes('__tests__') && 
           !path.includes('.test.') &&
           !path.includes('/tests/') &&
           !path.includes('\\tests\\');
  }

  private static isEducationDomain(path: string): boolean {
    return path.includes('/education/') || 
           path.includes('\\education\\') ||
           path.includes('/products/bella-education') ||
           path.includes('\\products\\bella-education');
  }

  private static isProductDomain(path: string): boolean {
    return path.includes('/products/bella-') || 
           path.includes('\\products\\bella-');
  }

  private static isTestCode(path: string): boolean {
    return path.includes('__tests__') || 
           path.includes('.test.') ||
           path.includes('/tests/') ||
           path.includes('\\tests\\');
  }

  private static isRemediationScript(path: string): boolean {
    return path.includes('/remediation/') ||
           path.includes('\\remediation\\') ||
           path.includes('/scripts/') ||
           path.includes('\\scripts\\');
  }
}

/**
 * Architecture Violation Error
 */
export class ArchitectureViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArchitectureViolation';
  }
}
