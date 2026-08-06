import { PluginLoader, HealthcarePluginLoadException } from '@/core/plugins/plugin-loader';
import { ExperienceMetadataRegistry } from '@/core/plugins/experience-registry';
import { ScopedCapabilityRegistry } from '../capabilities/capability-registry';
import { BellaMedicalPlugin } from '@/products/bella-medical';
import { BellaDentalPlugin } from '@/products/bella-dental';
import type { ResourceQueryCapability } from '../capabilities/query-capability';

describe('Bella Platform Architecture Governance Suite (ADR-001 & ADR-002)', () => {
  it('should load BellaMedicalPlugin cleanly via 7-step PluginLoader lifecycle', async () => {
    const capabilityRegistry = new ScopedCapabilityRegistry();
    const experienceRegistry = new ExperienceMetadataRegistry();
    const medicalPlugin = new BellaMedicalPlugin();

    await PluginLoader.load(medicalPlugin, capabilityRegistry, experienceRegistry, {});

    // Assert Manifest
    expect(medicalPlugin.manifest.id).toBe('bella-medical');
    expect(medicalPlugin.manifest.apiVersion).toBe('v2');

    // Assert Capabilities Registered
    expect(capabilityRegistry.has('medical_resource_query')).toBe(true);
    expect(capabilityRegistry.has('medical_resource_command')).toBe(true);

    const queryCap = capabilityRegistry.get<ResourceQueryCapability>('medical_resource_query');
    const rooms = await queryCap.getResources('tenant_1');
    expect(rooms.length).toBe(3);
    expect(rooms[0].resourceType).toBe('room');

    // Assert Experience Metadata Registered
    const widgets = experienceRegistry.getWidgets();
    expect(widgets.some(w => w.componentKey === 'RoomGridWidget')).toBe(true);
  });

  it('should load BellaDentalPlugin cleanly via 7-step PluginLoader lifecycle', async () => {
    const capabilityRegistry = new ScopedCapabilityRegistry();
    const experienceRegistry = new ExperienceMetadataRegistry();
    const dentalPlugin = new BellaDentalPlugin();

    await PluginLoader.load(dentalPlugin, capabilityRegistry, experienceRegistry, {});

    // Assert Manifest
    expect(dentalPlugin.manifest.id).toBe('bella-dental');

    // Assert Capabilities Registered
    expect(capabilityRegistry.has('dental_resource_query')).toBe(true);
    expect(capabilityRegistry.has('dental_resource_command')).toBe(true);

    const queryCap = capabilityRegistry.get<ResourceQueryCapability>('dental_resource_query');
    const chairs = await queryCap.getResources('tenant_1');
    expect(chairs.length).toBe(3);
    expect(chairs[0].resourceType).toBe('chair');

    // Assert Experience Metadata Registered
    const widgets = experienceRegistry.getWidgets();
    expect(widgets.some(w => w.componentKey === 'ChairGridWidget')).toBe(true);
  });

  it('should enforce instance-level isolation between ScopedCapabilityRegistries', () => {
    const registryA = new ScopedCapabilityRegistry();
    const registryB = new ScopedCapabilityRegistry();
    const medicalPlugin = new BellaMedicalPlugin();

    medicalPlugin.registerCapabilities(registryA);

    expect(registryA.has('medical_resource_query')).toBe(true);
    expect(registryB.has('medical_resource_query')).toBe(false); // Isolated!
  });

  it('should fail fast with HealthcarePluginLoadException when plugin validation fails', async () => {
    const capabilityRegistry = new ScopedCapabilityRegistry();
    const experienceRegistry = new ExperienceMetadataRegistry();

    const invalidPlugin = new BellaMedicalPlugin();

    // Mock validation failure
    Object.defineProperty(invalidPlugin, 'validate', {
      value: () => false,
    });

    await expect(
      PluginLoader.load(invalidPlugin, capabilityRegistry, experienceRegistry, {})
    ).rejects.toThrow(HealthcarePluginLoadException);
  });
});
