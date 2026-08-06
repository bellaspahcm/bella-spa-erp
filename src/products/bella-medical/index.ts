import type { ProductPluginContract, CapabilityRegistryContract } from '@/core/plugins/plugin-loader';
import type { ExperienceMetadataRegistry } from '@/core/plugins/experience-registry';
import type { AICapabilityPack } from '@/core/plugins/ai-capability-pack';
import { medicalProductManifest } from './manifest';
import { MedicalResourceQueryCapability } from './capabilities/MedicalResourceQueryCapability';
import { MedicalResourceCommandCapability } from './capabilities/MedicalResourceCommandCapability';
import { medicalAICapabilityPack } from './ai-skills/MedicalAICapabilityPack';

export class BellaMedicalPlugin implements ProductPluginContract<unknown> {
  readonly manifest = medicalProductManifest;

  registerCapabilities(registry: CapabilityRegistryContract): void {
    const queryCap = new MedicalResourceQueryCapability();
    const commandCap = new MedicalResourceCommandCapability();
    registry.register(queryCap.id, queryCap);
    registry.register(commandCap.id, commandCap);
  }

  registerExperience(registry: ExperienceMetadataRegistry): void {
    registry.registerWidget({
      id: 'medical_room_grid',
      componentKey: 'RoomGridWidget',
      title: 'Sơ đồ phòng khám y tế',
      permissions: ['medical.view'],
    });

    registry.registerPage({
      route: '/dashboard/medical',
      componentKey: 'MedicalDashboardPage',
      title: 'Y Tế Đa Khoa Dashboard',
      icon: 'Stethoscope',
      permissions: ['medical.view'],
    });

    registry.registerMenu({
      id: 'menu_medical',
      label: 'Y tế Đa khoa',
      path: '/dashboard/medical',
      icon: 'Stethoscope',
      order: 10,
    });
  }

  registerAICapabilityPack(): AICapabilityPack {
    return medicalAICapabilityPack;
  }
}
