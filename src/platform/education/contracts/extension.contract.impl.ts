import { IEducationEnrollmentExtensionContract, CalculateTuitionInput, CalculateTuitionOutput } from './extension.contract';

// Controlled extension registry mapping tenant IDs to their approved extension routines.
class TenantExtensionRegistry {
  private extensions: Map<string, IEducationEnrollmentExtensionContract> = new Map();

  register(tenantId: string, ext: IEducationEnrollmentExtensionContract): void {
    this.extensions.set(tenantId, ext);
  }

  get(tenantId: string): IEducationEnrollmentExtensionContract | undefined {
    return this.extensions.get(tenantId);
  }
}

export const tenantExtensionRegistry = new TenantExtensionRegistry();

// 1. Standard Tenant Extension (Returns base tuition fee)
class StandardTuitionExtension implements IEducationEnrollmentExtensionContract {
  public async calculateTuition(input: CalculateTuitionInput): Promise<CalculateTuitionOutput> {
    return {
      finalTuitionFee: input.baseTuitionFee,
      isCorporateFunded: false,
    };
  }
}

// 2. Strict Tenant Extension (Applies 10% discount for academic excellence or early registration)
class StrictTuitionExtension implements IEducationEnrollmentExtensionContract {
  public async calculateTuition(input: CalculateTuitionInput): Promise<CalculateTuitionOutput> {
    const finalFee = Math.round(input.baseTuitionFee * 0.9); // 10% discount
    return {
      finalTuitionFee: finalFee,
      isCorporateFunded: false,
    };
  }
}

// 3. Corporate Tenant Extension (Tuition is corporate funded)
class CorporateTuitionExtension implements IEducationEnrollmentExtensionContract {
  public async calculateTuition(input: CalculateTuitionInput): Promise<CalculateTuitionOutput> {
    return {
      finalTuitionFee: 0, // No student-direct cash fee
      isCorporateFunded: true,
      corporateClientPartyId: 'corp-client-partner-99', // Corporate sponsor ID
    };
  }
}

// Seed the approved tenant extensions into the Registry
tenantExtensionRegistry.register('tenant-standard', new StandardTuitionExtension());
tenantExtensionRegistry.register('tenant-strict', new StrictTuitionExtension());
tenantExtensionRegistry.register('tenant-corporate', new CorporateTuitionExtension());

// The dynamic wrapper implementation that routes call based on tenant context
export class EducationEnrollmentExtensionContractImpl implements IEducationEnrollmentExtensionContract {
  public async calculateTuition(input: CalculateTuitionInput): Promise<CalculateTuitionOutput> {
    if (!input.tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required in extension contract.');
    }

    const ext = tenantExtensionRegistry.get(input.tenantId);
    if (!ext) {
      // Default fallback if no custom extension is registered for the tenant
      return {
        finalTuitionFee: input.baseTuitionFee,
        isCorporateFunded: false,
      };
    }

    return ext.calculateTuition(input);
  }
}
