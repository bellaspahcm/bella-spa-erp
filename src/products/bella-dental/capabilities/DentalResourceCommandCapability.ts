import type { ResourceCommandCapability, AssignResourceCommand } from '@/modules/bella-healthcare-kernel/capabilities/command-capability';

export class DentalResourceCommandCapability implements ResourceCommandCapability {
  readonly id = 'dental_resource_command';
  readonly version = '1.0.0';
  readonly capabilityType = 'command' as const;

  async assignResource(command: AssignResourceCommand): Promise<{ readonly success: boolean; readonly message?: string }> {
    console.log(`[DentalResourceCommand] Assigning dental chair ${command.resourceId} to encounter ${command.encounterId}`);
    return { success: true, message: `Ghế nha ${command.resourceId} đã được phân bổ thành công` };
  }

  async releaseResource(_tenantId: string, resourceId: string): Promise<{ readonly success: boolean }> {
    console.log(`[DentalResourceCommand] Releasing dental chair ${resourceId}`);
    return { success: true };
  }
}
