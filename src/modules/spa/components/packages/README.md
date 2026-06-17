# Spa Package Management Components

This directory contains spa-specific package management UI components.

## Components

- Package list and catalog views
- Package creation and editing forms
- Package category management (Basic, Premium, VIP)
- Session multiplier configuration interfaces

## Usage

```tsx
import { PackageList, PackageForm } from '@/modules/spa/components/packages';
```

## Architecture

These components:
- Use `CoreServiceCatalogItem` as the base type
- Use `SpaPackageService` for package operations
- Handle package-specific metadata (total_sessions, session_multiplier, category)
- Support package tiers with different session multipliers (1.0x, 1.5x, 2.0x)

