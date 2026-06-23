// apps/mobile/src/contexts/AuthContext.tsx
// 4-state auth flow: loading → loading-profile → authenticated/unauthenticated

import type { AuthState, CurrentUser } from '@bella/shared';
import type { Session } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchUserProfile } from '../services/auth/fetchUserProfile';
import { getMobileSupabase } from '../lib/supabase';

type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    const supabase = getMobileSupabase();

    // Restore session from AsyncStorage on app startup
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSession(session: Session | null) {
    if (!session?.user) {
      setState({ status: 'unauthenticated' });
      return;
    }

    // Have session → transition to loading-profile (query users table)
    setState({ status: 'loading-profile' });

    const result = await fetchUserProfile(
      session.user.id,
      session.user.email ?? '',
    );

    if (!result.ok) {
      // Profile fetch failed → treat as unauthenticated
      console.warn('[AuthContext] Profile fetch failed:', result.error);
      setState({ status: 'unauthenticated' });
      return;
    }

    if (result.user.isSuspended) {
      console.warn('[AuthContext] User tenant is suspended');
      setState({ status: 'unauthenticated' });
      return;
    }

    setState({ status: 'authenticated', user: result.user });
  }

  async function signIn(email: string, password: string) {
    const supabase = getMobileSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }

  async function signOut() {
    const supabase = getMobileSupabase();
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
