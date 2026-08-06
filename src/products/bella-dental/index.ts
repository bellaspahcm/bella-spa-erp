import type { ProductPluginContract, CapabilityRegistryContract } from '@/core/plugins/plugin-loader';
import type { ExperienceMetadataRegistry } from '@/core/plugins/experience-registry';
import type { AICapabilityPack } from '@/core/plugins/ai-capability-pack';
import { dentalProductManifest } from './manifest';
import { DentalResourceQueryCapability } from './capabilities/DentalResourceQueryCapability';
import { DentalResourceCommandCapability } from './capabilities/DentalResourceCommandCapability';
import { dentalAICapabilityPack } from './ai-skills/DentalAICapabilityPack';

export class BellaDentalPlugin implements ProductPluginContract<unknown> {
  readonly manifest = dentalProductManifest;

  registerCapabilities(registry: CapabilityRegistryContract): void {
    const queryCap = new DentalResourceQueryCapability();
    const commandCap = new DentalResourceCommandCapability();
    registry.register(queryCap.id, queryCap);
    registry.register(commandCap.id, commandCap);
  }

  registerExperience(registry: ExperienceMetadataRegistry): void {
    registry.registerWidget({
      id: 'dental_chair_grid',
      componentKey: 'ChairGridWidget',
      title: 'Sơ đồ ghế điều trị nha khoa',
      permissions: ['dental.view'],
    });

    registry.registerPage({
      route: '/dashboard/dental',
      componentKey: 'DentalDashboardPage',
      title: 'Nha Khoa Dashboard',
      icon: 'Tooth',
      permissions: ['dental.view'],
    });

    registry.registerMenu({
      id: 'menu_dental',
      label: 'Nha khoa',
      path: '/dashboard/dental',
      icon: 'Tooth',
      order: 11,
    });
  }

  registerAICapabilityPack(): AICapabilityPack {
    return dentalAICapabilityPack;
  }
}
