/**
 * BELLA EIP Platform Legacy Bridge
 * Provides safe adapters between legacy Spa code and platform contracts.
 */
export class LegacySpaBridge {
  static adaptTenantModuleKey(rawKey: string): string {
    if (!rawKey) return 'beauty_spa';
    const normalized = rawKey.trim().toLowerCase();
    if (normalized === 'real_estate' || normalized === 'realestate' || normalized === 'land') {
      return 'real_estate';
    }
    if (normalized === 'babycare') {
      return 'babycare';
    }
    return 'beauty_spa';
  }
}
