'use server';

/**
 * @module modules/real_estate/actions/peopleActions
 *
 * Server Actions wrapping PeopleCommandService for Real Estate module UI.
 *
 * Architectural rules:
 * - Uses Foundation PeopleCommandService (Layer 1) via SupabasePeopleProvider.
 * - createServerClient for proper RLS context.
 * - All DB errors are re-thrown — Rule #1: Zero Silent Database Failures.
 * - Registers as a command via SupabasePeopleProvider (not the registry pattern)
 *   because commands are transient — no need to pre-register.
 *
 * @layer Module (Layer 3)
 */

import { createClient } from '@/lib/supabase-server';
import { SupabasePeopleProvider } from '@/foundation/people/SupabasePeopleProvider';
import type { AssignableType, AssignableReference } from '@/foundation/contracts';

// ─── Helper ───────────────────────────────────────────────────────────────────

function buildProvider(): SupabasePeopleProvider {
  const db = createClient();
  return new SupabasePeopleProvider(db);
}

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreatePersonInput {
  tenantId: string;
  displayName: string;
  type: AssignableType;
  email?: string;
  phone?: string;
  branch?: string; // stored as metadata.branch
}

export interface UpdatePersonInput {
  personId: string;
  tenantId: string;
  displayName?: string;
  email?: string;
  phone?: string;
  branch?: string;
}

// ─── Action: Create / Register a new person ───────────────────────────────────

export async function createPersonAction(
  input: CreatePersonInput
): Promise<{ success: true; person: AssignableReference } | { success: false; error: string }> {
  try {
    const provider = buildProvider();
    const person = await provider.registerPerson({
      tenantId: input.tenantId,
      type: input.type,
      displayName: input.displayName,
      email: input.email,
      phone: input.phone,
      metadata: input.branch ? { branch: input.branch } : undefined,
    });
    return { success: true, person };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[peopleActions.createPerson] Error: %s', msg);
    return { success: false, error: msg };
  }
}

// ─── Action: Update an existing person ───────────────────────────────────────

export async function updatePersonAction(
  input: UpdatePersonInput
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const provider = buildProvider();

    if (input.displayName) {
      await provider.updateDisplayName(input.personId, input.tenantId, input.displayName);
    }

    const profilePatch: {
      email?: string;
      phone?: string;
      metadata?: Record<string, unknown>;
    } = {};

    if (input.email !== undefined) profilePatch.email = input.email;
    if (input.phone !== undefined) profilePatch.phone = input.phone;
    if (input.branch !== undefined) profilePatch.metadata = { branch: input.branch };

    if (Object.keys(profilePatch).length > 0) {
      await provider.updateProfile(input.personId, input.tenantId, profilePatch);
    }

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[peopleActions.updatePerson] Error: %s', msg);
    return { success: false, error: msg };
  }
}

// ─── Action: Deactivate (soft-delete) a person ───────────────────────────────

export async function deactivatePersonAction(params: {
  personId: string;
  tenantId: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const provider = buildProvider();
    await provider.deactivatePerson(params.personId, params.tenantId);
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[peopleActions.deactivatePerson] Error: %s', msg);
    return { success: false, error: msg };
  }
}
