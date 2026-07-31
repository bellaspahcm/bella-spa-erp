export interface VerticalManifest {
  key: string;
  name: string;
  version: string;
  themeKey: string;
  defaultRoute: string;
  enabledCapabilities: string[];
  menus: Array<{
    id: string;
    label: string;
    href: string;
    icon?: string;
  }>;
}

class VerticalRegistry {
  private manifests: Map<string, VerticalManifest> = new Map();

  register(manifest: VerticalManifest): void {
    this.manifests.set(manifest.key, manifest);
  }

  get(key: string): VerticalManifest | undefined {
    return this.manifests.get(key);
  }

  getAll(): VerticalManifest[] {
    return Array.from(this.manifests.values());
  }

  has(key: string): boolean {
    return this.manifests.has(key);
  }
}

export const verticalRegistry = new VerticalRegistry();
