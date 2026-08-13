/**
 * Product Manifest Contract for Bella Host Platform Plugins
 * Multi-dimensional versioning & dependency contracts.
 * ZERO `any` allowed.
 */

export interface HealthcareMenuItem {
  readonly id: string;
  readonly label: string;
  readonly path: string;
  readonly icon?: string;
  readonly order?: number;
  readonly badge?: string;
}

export interface HealthcareRoute {
  readonly path: string;
  readonly title: string;
  readonly componentKey: string;
}

export interface ProductManifest {
  readonly id: string; // e.g. "bella-medical", "bella-dental", "bella-hospital"
  readonly name: string;
  readonly version: string;
  readonly apiVersion: string;       // e.g. "v2"
  readonly schemaVersion: string;    // e.g. "v1.4"
  readonly eventVersion: string;     // e.g. "v1"
  readonly minimumKernelVersion: string;
  readonly supportedHostVersion: string;
  readonly dependencies: readonly string[]; // Required capabilities e.g. ["billing_query", "inventory_command"]
  readonly permissions: readonly string[];
  readonly featureFlags?: Readonly<Record<string, boolean>>;
  readonly capabilities?: readonly string[];
  readonly workflows?: readonly string[];
  readonly clinicalPolicies?: readonly string[];
  readonly integrations?: readonly string[];
}
