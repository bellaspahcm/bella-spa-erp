/**
 * Example component demonstrating useTenantContext() hook usage.
 * 
 * This file serves as a reference for developers learning how to use
 * tenant context in their components. It is NOT used in production.
 * 
 * @example
 * Copy patterns from this file into your actual components.
 */

'use client';

import { useTenantContext } from '@/core/hooks/useTenantContext';

function getStringSetting(settings: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = settings[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Example: Basic tenant information display.
 * 
 * Shows tenant name, subscription plan, and enabled modules.
 */
export function TenantInfoExample() {
  const context = useTenantContext();

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h2 className="text-xl font-bold mb-2">{context.tenantName}</h2>
      
      <div className="space-y-2 text-sm">
        <p>
          <span className="font-medium">Subscription:</span>{' '}
          <span className="capitalize">{context.subscriptionPlan}</span>
        </p>
        
        <p>
          <span className="font-medium">Enabled Modules:</span>{' '}
          {context.enabledModules.join(', ')}
        </p>
        
        <p>
          <span className="font-medium">Currency:</span>{' '}
          {getStringSetting(context.settings, 'currency') || 'VND'}
        </p>
      </div>
    </div>
  );
}

/**
 * Example: Feature flag conditional rendering.
 * 
 * Shows how to conditionally render UI based on feature flags.
 */
export function FeatureFlagExample() {
  const context = useTenantContext();
  
  const aiEnabled = context.featureFlags['ai_salary_reconciliation'];
  const inventoryEnabled = context.featureFlags['inventory_transfer'];

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-bold mb-2">Available Features</h3>
      
      <ul className="space-y-1 text-sm">
        {aiEnabled && (
          <li className="text-green-600">✓ AI Salary Reconciliation</li>
        )}
        {inventoryEnabled && (
          <li className="text-green-600">✓ Inventory Transfer</li>
        )}
        {!aiEnabled && !inventoryEnabled && (
          <li className="text-gray-500">No advanced features enabled</li>
        )}
      </ul>
    </div>
  );
}

/**
 * Example: Subscription tier gating.
 * 
 * Shows different content based on subscription plan.
 */
export function SubscriptionGatedExample() {
  const context = useTenantContext();
  
  const isPremium = 
    context.subscriptionPlan === 'professional' || 
    context.subscriptionPlan === 'enterprise';

  if (!isPremium) {
    return (
      <div className="p-4 border border-yellow-300 bg-yellow-50 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>Upgrade Required:</strong> This feature requires Professional or Enterprise plan.
        </p>
        <button className="mt-2 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700">
          Upgrade Now
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-white">
      <h3 className="font-bold mb-2">Premium Feature</h3>
      <p className="text-sm text-gray-600">
        You have access to this premium feature!
      </p>
      {/* Actual premium feature content here */}
    </div>
  );
}

/**
 * Example: Module-specific component.
 * 
 * Only renders if the spa module is enabled.
 */
export function ModuleSpecificExample() {
  const context = useTenantContext();
  
  // Don't render if spa module is not enabled
  if (!context.enabledModules.includes('spa')) {
    return null;
  }

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-bold mb-2">Spa Module Widget</h3>
      <p className="text-sm text-gray-600">
        This widget only appears when the spa module is enabled.
      </p>
      {/* Spa-specific content here */}
    </div>
  );
}

/**
 * Example: Using tenant settings for branding.
 * 
 * Applies tenant-specific colors and branding.
 */
export function BrandingExample() {
  const context = useTenantContext();
  
  const logoUrl = getStringSetting(context.settings, 'logoUrl');
  const primaryColor = getStringSetting(context.settings, 'primaryColor') || '#3B82F6';
  const companyName = getStringSetting(context.settings, 'companyName') || context.tenantName;

  return (
    <div 
      className="p-4 border rounded-lg"
      style={{ borderColor: primaryColor }}
    >
      {logoUrl && (
        <img 
          src={logoUrl} 
          alt={`${companyName} logo`}
          className="h-12 mb-2"
        />
      )}
      
      <h3 
        className="font-bold text-lg"
        style={{ color: primaryColor }}
      >
        {companyName}
      </h3>
      
      <p className="text-sm text-gray-600 mt-2">
        This component uses tenant-specific branding colors and logo.
      </p>
    </div>
  );
}

/**
 * Example: Multi-module dashboard.
 * 
 * Shows different sections based on enabled modules.
 */
export function MultiModuleDashboardExample() {
  const context = useTenantContext();
  
  const hasSpa = context.enabledModules.includes('spa');
  const hasBabycare = context.enabledModules.includes('babycare');
  const hasCleaning = context.enabledModules.includes('cleaning');

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {hasSpa && (
          <div className="p-4 border rounded-lg bg-blue-50">
            <h3 className="font-bold">Spa Module</h3>
            <p className="text-sm">Today&apos;s bookings: 15</p>
          </div>
        )}
        
        {hasBabycare && (
          <div className="p-4 border rounded-lg bg-pink-50">
            <h3 className="font-bold">Babycare Module</h3>
            <p className="text-sm">Active packages: 8</p>
          </div>
        )}
        
        {hasCleaning && (
          <div className="p-4 border rounded-lg bg-green-50">
            <h3 className="font-bold">Cleaning Module</h3>
            <p className="text-sm">Scheduled jobs: 12</p>
          </div>
        )}
        
        {!hasSpa && !hasBabycare && !hasCleaning && (
          <div className="p-4 border rounded-lg bg-gray-50">
            <p className="text-sm text-gray-600">
              No modules enabled. Contact support to activate modules.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
