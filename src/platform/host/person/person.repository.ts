/**
 * Person Repository - Database Access Layer
 * 
 * Handles persistence of Person aggregates.
 * 
 * @module platform/host/person/person.repository
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Person, QueryPersonsRequest } from './types';
import { Database, Json } from '@/types/database.types';

type PersonRow = Database['public']['Tables']['persons']['Row'];
type PersonInsert = Database['public']['Tables']['persons']['Insert'];
type PersonUpdate = Database['public']['Tables']['persons']['Update'];

/**
 * Person Repository
 * 
 * Manages Person persistence in database.
 */
export class PersonRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  /**
   * Save a new person to database
   */
  async save(person: Person): Promise<Person> {
    const insert: PersonInsert = {
      id: person.personId,
      tenant_id: person.tenantId,
      first_name: person.firstName,
      last_name: person.lastName,
      middle_name: person.middleName || null,
      date_of_birth: person.dateOfBirth,
      gender: person.gender,
      nationality: person.nationality || null,
      identifiers: person.identifiers as unknown as Database['public']['Tables']['persons']['Insert']['identifiers'],
      contacts: person.contacts as unknown as Database['public']['Tables']['persons']['Insert']['contacts'],
      addresses: person.addresses as unknown as Database['public']['Tables']['persons']['Insert']['addresses'],
      photo_url: person.photoUrl || null,
      preferred_language: person.preferredLanguage || null,
      status: person.status,
      metadata: (person.metadata as Json) || null,
      created_at: person.createdAt,
      updated_at: person.updatedAt,
      created_by: person.createdBy || null,
      updated_by: person.updatedBy || null,
    };

    const { data, error } = await this.supabase
      .from('persons')
      .insert(insert)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save person: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  /**
   * Update existing person
   */
  async update(person: Person): Promise<Person> {
    const update: PersonUpdate = {
      first_name: person.firstName,
      last_name: person.lastName,
      middle_name: person.middleName || null,
      date_of_birth: person.dateOfBirth,
      gender: person.gender,
      nationality: person.nationality || null,
      identifiers: person.identifiers as unknown as Database['public']['Tables']['persons']['Update']['identifiers'],
      contacts: person.contacts as unknown as Database['public']['Tables']['persons']['Update']['contacts'],
      addresses: person.addresses as unknown as Database['public']['Tables']['persons']['Update']['addresses'],
      photo_url: person.photoUrl || null,
      preferred_language: person.preferredLanguage || null,
      status: person.status,
      metadata: (person.metadata as Json) || null,
      updated_at: person.updatedAt,
      updated_by: person.updatedBy || null,
    };

    const { data, error } = await this.supabase
      .from('persons')
      .update(update)
      .eq('id', person.personId)
      .eq('tenant_id', person.tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update person: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  /**
   * Find person by ID
   */
  async findById(personId: string, tenantId: string): Promise<Person | null> {
    const { data, error } = await this.supabase
      .from('persons')
      .select('*')
      .eq('id', personId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find person: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  /**
   * Query persons with filters
   */
  async query(request: QueryPersonsRequest): Promise<Person[]> {
    let query = this.supabase
      .from('persons')
      .select('*')
      .eq('tenant_id', request.tenantId);

    // Apply filters
    if (request.firstName) {
      query = query.ilike('first_name', `%${request.firstName}%`);
    }

    if (request.lastName) {
      query = query.ilike('last_name', `%${request.lastName}%`);
    }

    if (request.dateOfBirth) {
      query = query.eq('date_of_birth', request.dateOfBirth);
    }

    if (request.status) {
      query = query.eq('status', request.status);
    }

    // Apply pagination
    const limit = request.limit || 50;
    const offset = request.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to query persons: ${error.message}`);
    }

    return data.map(row => this.mapToDomain(row));
  }

  /**
   * Find person by identifier
   */
  async findByIdentifier(
    tenantId: string,
    identifierType: string,
    identifierValue: string
  ): Promise<Person | null> {
    // Query using JSONB contains operator
    const { data, error } = await this.supabase
      .from('persons')
      .select('*')
      .eq('tenant_id', tenantId)
      .contains('identifiers', [{ type: identifierType, value: identifierValue }])
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find person by identifier: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  /**
   * Find person by contact (email or phone)
   */
  async findByContact(
    tenantId: string,
    contactType: 'email' | 'phone' | 'mobile',
    contactValue: string
  ): Promise<Person | null> {
    // Query using JSONB contains operator
    const { data, error } = await this.supabase
      .from('persons')
      .select('*')
      .eq('tenant_id', tenantId)
      .contains('contacts', [{ type: contactType, value: contactValue }])
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find person by contact: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  /**
   * Delete person (soft delete - set status to inactive)
   */
  async delete(personId: string, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from('persons')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', personId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to delete person: ${error.message}`);
    }
  }

  /**
   * Check if person exists
   */
  async exists(personId: string, tenantId: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('persons')
      .select('id', { count: 'exact', head: true })
      .eq('id', personId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to check person existence: ${error.message}`);
    }

    return (count || 0) > 0;
  }

  // ============================================================================
  // Private Mapping Methods
  // ============================================================================

  private mapToDomain(row: PersonRow): Person {
    return {
      personId: row.id,
      tenantId: row.tenant_id,
      firstName: row.first_name,
      lastName: row.last_name,
      middleName: row.middle_name || undefined,
      dateOfBirth: row.date_of_birth,
      gender: row.gender as Person['gender'],
      nationality: row.nationality || undefined,
      identifiers: (row.identifiers as unknown as Person['identifiers']) || [],
      contacts: (row.contacts as unknown as Person['contacts']) || [],
      addresses: (row.addresses as unknown as Person['addresses']) || [],
      photoUrl: row.photo_url || undefined,
      preferredLanguage: row.preferred_language || undefined,
      status: row.status as Person['status'],
      metadata: (row.metadata as Record<string, unknown>) || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by || undefined,
      updatedBy: row.updated_by || undefined,
    };
  }
}

