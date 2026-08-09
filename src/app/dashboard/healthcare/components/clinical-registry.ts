import React from 'react';
import { ClinicalContextType } from './ClinicalContext';

// 1. Component Registry Contract
export interface ClinicalWorkspaceComponent {
  readonly name: string;
  readonly capability: string;
  readonly permissions: string[];
  readonly region: 'header' | 'left' | 'center' | 'right' | 'footer';
  readonly priority: number;
  visible(context: ClinicalContextType): boolean;
  render(context: ClinicalContextType): React.ReactNode;
}

class HealthcareComponentRegistryClass {
  private registry: Map<string, ClinicalWorkspaceComponent> = new Map();

  register(component: ClinicalWorkspaceComponent) {
    this.registry.set(component.name, component);
  }

  resolve(name: string): ClinicalWorkspaceComponent | undefined {
    return this.registry.get(name);
  }

  unregister(name: string) {
    this.registry.delete(name);
  }

  override(component: ClinicalWorkspaceComponent) {
    this.registry.set(component.name, component);
  }

  getAll(): ClinicalWorkspaceComponent[] {
    return Array.from(this.registry.values());
  }
}

export const HealthcareComponentRegistry = new HealthcareComponentRegistryClass();

// 2. Widget Registry Contract
export interface DashboardWidget {
  readonly id: string;
  readonly capability: string;
  visible(user: unknown): boolean;
  render(context?: unknown): React.ReactNode;
}

class WidgetRegistryClass {
  private widgets: Map<string, DashboardWidget> = new Map();

  register(widget: DashboardWidget) {
    this.widgets.set(widget.id, widget);
  }

  resolve(id: string): DashboardWidget | undefined {
    return this.widgets.get(id);
  }

  getAll(): DashboardWidget[] {
    return Array.from(this.widgets.values());
  }
}

export const WidgetRegistry = new WidgetRegistryClass();

// 3. Navigation Registry Contract
export interface NavigationItem {
  readonly id: string;
  readonly label: string;
  readonly path: string;
  readonly iconName: string;
  readonly capability: string;
}

class NavigationRegistryClass {
  private items: Map<string, NavigationItem> = new Map();

  register(item: NavigationItem) {
    this.items.set(item.id, item);
  }

  resolve(id: string): NavigationItem | undefined {
    return this.items.get(id);
  }

  getAll(): NavigationItem[] {
    return Array.from(this.items.values());
  }
}

export const NavigationRegistry = new NavigationRegistryClass();

// 4. Theme Registry
export interface ThemeTokens {
  readonly id: string;
  readonly primaryColor: string; // e.g. 'indigo', 'emerald', 'teal', 'rose'
  readonly accentColor: string;
  readonly sidebarBackground: string;
}

class ThemeRegistryClass {
  private themes: Map<string, ThemeTokens> = new Map();

  register(theme: ThemeTokens) {
    this.themes.set(theme.id, theme);
  }

  resolve(id: string): ThemeTokens | undefined {
    return this.themes.get(id) || { id: 'default', primaryColor: 'indigo', accentColor: 'indigo', sidebarBackground: 'bg-slate-900' };
  }
}

export const ThemeRegistry = new ThemeRegistryClass();
