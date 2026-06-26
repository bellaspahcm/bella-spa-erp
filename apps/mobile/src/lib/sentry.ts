/**
 * Sentry Configuration for Bella Spa Mobile
 * TEMP: Disabled for Expo Go testing - re-enable before production build
 */

export function initSentry() {}
export function setSentryUser(_user: any) {}
export function clearSentryUser() {}
export function setSentryTags(_tags: any) {}
export function addSentryBreadcrumb(_message: string, _category: string, _data?: any) {}
export function captureException(_error: Error, _context?: any) {}
export function captureMessage(_message: string, _level?: any) {}
export function startTransaction(_name: string, _op?: string) { return null; }
export function testSentry() {}
export const Sentry = null;
