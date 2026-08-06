import type { ResourceCommandCapability, AssignResourceCommand } from '@/modules/bella-healthcare-kernel/capabilities/command-capability';

export class MedicalResourceCommandCapability implements ResourceCommandCapability {
  readonly id = 'medical_resource_command';
  readonly version = '1.0.0';
  readonly capabilityType = 'command' as const;

  async assignResource(command: AssignResourceCommand): Promise<{ readonly success: boolean; readonly message?: string }> {
    console.log(`[MedicalResourceCommand] Assigning medical room ${command.resourceId} to encounter ${command.encounterId}`);
    return { success: true, message: `Phòng khám ${command.resourceId} đã được gán thành công` };
  }

  async releaseResource(_tenantId: string, resourceId: string): Promise<{ readonly success: boolean }> {
    console.log(`[MedicalResourceCommand] Releasing medical room ${resourceId}`);
    return { success: true };
  }
}
