/**
 * Metadata-based Experience Registry for Host Platform UI Registration
 * Registers UI metadata (component keys, permissions, feature flags) instead of raw React instances.
 * ZERO `any` allowed.
 */

export interface WidgetMetadata {
  readonly id: string;
  readonly componentKey: string;
  readonly title: string;
  readonly description?: string;
  readonly permissions?: readonly string[];
  readonly featureFlags?: readonly string[];
}

export interface PageMetadata {
  readonly route: string;
  readonly componentKey: string;
  readonly title: string;
  readonly icon?: string;
  readonly permissions?: readonly string[];
}

export interface MenuMetadata {
  readonly id: string;
  readonly label: string;
  readonly path: string;
  readonly icon?: string;
  readonly order?: number;
  readonly badge?: string;
}

export class ExperienceMetadataRegistry {
  private widgets = new Map<string, WidgetMetadata>();
  private pages = new Map<string, PageMetadata>();
  private menus: MenuMetadata[] = [];

  registerWidget(metadata: WidgetMetadata): void {
    this.widgets.set(metadata.id, metadata);
  }

  getWidget(id: string): WidgetMetadata | undefined {
    return this.widgets.get(id);
  }

  getWidgets(): readonly WidgetMetadata[] {
    return Array.from(this.widgets.values());
  }

  registerPage(metadata: PageMetadata): void {
    this.pages.set(metadata.route, metadata);
  }

  getPage(route: string): PageMetadata | undefined {
    return this.pages.get(route);
  }

  getPages(): readonly PageMetadata[] {
    return Array.from(this.pages.values());
  }

  registerMenu(menu: MenuMetadata): void {
    const existingIndex = this.menus.findIndex((m) => m.id === menu.id);
    if (existingIndex >= 0) {
      this.menus[existingIndex] = menu;
    } else {
      this.menus.push(menu);
    }
    this.menus.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  getMenus(): readonly MenuMetadata[] {
    return this.menus;
  }
}
