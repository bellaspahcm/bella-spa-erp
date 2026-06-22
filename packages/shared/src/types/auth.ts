/**
 * Auth types for Bella ERP
 * Source of truth for authentication state across web + mobile
 */

export interface CurrentUser {
  id: string;
  email: string;
  full_name?: string | null;
  role: string;
  avatar_url?: string | null;
  tenant_id: string | null;
  isSuspended?: boolean;
}

/**
 * 4-state authentication flow
 * - loading: App starting, checking session from storage
 * - loading-profile: Session found, fetching user profile from DB
 * - authenticated: Profile loaded, user is authenticated
 * - unauthenticated: No session or profile fetch failed
 */
export type AuthState =
  | { status: 'loading' }
  | { status: 'loading-profile' }
  | { status: 'authenticated'; user: CurrentUser }
  | { status: 'unauthenticated' };
