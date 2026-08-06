'use client';

/**
 * Healthcare Kernel Context & Provider
 * Scope-isolated Provider supplying CapabilityRegistry and ExperienceMetadataRegistry to UI.
 * Zero `any` allowed.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { ScopedCapabilityRegistry } from '../capabilities/capability-registry';
import { ExperienceMetadataRegistry } from '@/core/plugins/experience-registry';
import type { ProductManifest } from '@/core/plugins/manifest';

export interface HealthcareKernelContextValue {
  readonly manifest: ProductManifest | null;
  readonly capabilityRegistry: ScopedCapabilityRegistry;
  readonly experienceRegistry: ExperienceMetadataRegistry;
  readonly isInitialized: boolean;
}

const HealthcareKernelContext = createContext<HealthcareKernelContextValue | null>(null);

export interface HealthcareKernelProviderProps {
  readonly children: React.ReactNode;
  readonly manifest: ProductManifest | null;
  readonly capabilityRegistry: ScopedCapabilityRegistry;
  readonly experienceRegistry: ExperienceMetadataRegistry;
}

export const HealthcareKernelProvider: React.FC<HealthcareKernelProviderProps> = ({
  children,
  manifest,
  capabilityRegistry,
  experienceRegistry,
}) => {
  const value = useMemo<HealthcareKernelContextValue>(
    () => ({
      manifest,
      capabilityRegistry,
      experienceRegistry,
      isInitialized: Boolean(manifest),
    }),
    [manifest, capabilityRegistry, experienceRegistry]
  );

  return (
    <HealthcareKernelContext.Provider value={value}>
      {children}
    </HealthcareKernelContext.Provider>
  );
};

export const useHealthcareKernel = (): HealthcareKernelContextValue => {
  const context = useContext(HealthcareKernelContext);
  if (!context) {
    throw new Error('useHealthcareKernel must be used within a HealthcareKernelProvider');
  }
  return context;
};
