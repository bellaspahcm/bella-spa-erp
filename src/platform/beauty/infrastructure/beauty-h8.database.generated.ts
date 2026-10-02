/*
 * Scoped Beauty OS H8 database contract.
 *
 * Source evidence:
 *   supabase gen types typescript --project-id bmnbqbcdbuklhopfbopv
 *
 * The repository-wide src/types/database.types.ts is currently generated from a
 * broader/stale source and does not include these Beauty H8 tables. Replacing it
 * from the E2E project would delete unrelated schema types, so this scoped
 * generated contract is limited to the H8 tables consumed by the Beauty OS
 * persistence adapter.
 */

export type BeautyH8Database = {
  public: {
    Tables: {
      beauty_appointments: {
        Row: {
          branch_id: string;
          cancellation_reason: string | null;
          created_at: string;
          customer_id: string;
          ends_at: string;
          id: string;
          service_id: string;
          starts_at: string;
          status: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          branch_id: string;
          cancellation_reason?: string | null;
          created_at?: string;
          customer_id: string;
          ends_at: string;
          id?: string;
          service_id: string;
          starts_at: string;
          status?: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string;
          cancellation_reason?: string | null;
          created_at?: string;
          customer_id?: string;
          ends_at?: string;
          id?: string;
          service_id?: string;
          starts_at?: string;
          status?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      beauty_professional_assignment_history: {
        Row: {
          actor_id: string;
          assignment_id: string;
          event_type: string;
          from_professional_id: string | null;
          id: string;
          occurred_at: string;
          reason: string;
          tenant_id: string;
          to_professional_id: string;
        };
        Insert: {
          actor_id: string;
          assignment_id: string;
          event_type: string;
          from_professional_id?: string | null;
          id?: string;
          occurred_at?: string;
          reason: string;
          tenant_id: string;
          to_professional_id: string;
        };
        Update: {
          actor_id?: string;
          assignment_id?: string;
          event_type?: string;
          from_professional_id?: string | null;
          id?: string;
          occurred_at?: string;
          reason?: string;
          tenant_id?: string;
          to_professional_id?: string;
        };
        Relationships: [];
      };
      beauty_professional_assignments: {
        Row: {
          actor_id: string | null;
          created_at: string;
          decided_at: string | null;
          id: string;
          professional_id: string;
          proposed_at: string;
          reason: string | null;
          replacement_for_id: string | null;
          service_commitment_id: string;
          status: string;
          tenant_id: string;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          id?: string;
          professional_id: string;
          proposed_at?: string;
          reason?: string | null;
          replacement_for_id?: string | null;
          service_commitment_id: string;
          status?: string;
          tenant_id: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          id?: string;
          professional_id?: string;
          proposed_at?: string;
          reason?: string | null;
          replacement_for_id?: string | null;
          service_commitment_id?: string;
          status?: string;
          tenant_id?: string;
        };
        Relationships: [];
      };
      beauty_resource_allocation_history: {
        Row: {
          actor_id: string;
          allocation_id: string;
          event_type: string;
          id: string;
          new_resource_id: string | null;
          occurred_at: string;
          old_resource_id: string | null;
          reason: string;
          replacement_allocation_id: string | null;
          segment_id: string;
          tenant_id: string;
        };
        Insert: {
          actor_id: string;
          allocation_id: string;
          event_type: string;
          id?: string;
          new_resource_id?: string | null;
          occurred_at?: string;
          old_resource_id?: string | null;
          reason: string;
          replacement_allocation_id?: string | null;
          segment_id: string;
          tenant_id: string;
        };
        Update: {
          actor_id?: string;
          allocation_id?: string;
          event_type?: string;
          id?: string;
          new_resource_id?: string | null;
          occurred_at?: string;
          old_resource_id?: string | null;
          reason?: string;
          replacement_allocation_id?: string | null;
          segment_id?: string;
          tenant_id?: string;
        };
        Relationships: [];
      };
      beauty_resource_allocations: {
        Row: {
          actor_id: string | null;
          capacity_units: number;
          created_at: string;
          ends_at: string;
          id: string;
          reason: string | null;
          released_at: string | null;
          replacement_for_id: string | null;
          resource_id: string;
          segment_id: string;
          service_commitment_id: string;
          starts_at: string;
          status: string;
          tenant_id: string;
        };
        Insert: {
          actor_id?: string | null;
          capacity_units?: number;
          created_at?: string;
          ends_at: string;
          id?: string;
          reason?: string | null;
          released_at?: string | null;
          replacement_for_id?: string | null;
          resource_id: string;
          segment_id: string;
          service_commitment_id: string;
          starts_at: string;
          status?: string;
          tenant_id: string;
        };
        Update: {
          actor_id?: string | null;
          capacity_units?: number;
          created_at?: string;
          ends_at?: string;
          id?: string;
          reason?: string | null;
          released_at?: string | null;
          replacement_for_id?: string | null;
          resource_id?: string;
          segment_id?: string;
          service_commitment_id?: string;
          starts_at?: string;
          status?: string;
          tenant_id?: string;
        };
        Relationships: [];
      };
      beauty_sessions: {
        Row: {
          actual_end_at: string | null;
          actual_performer_id: string | null;
          actual_start_at: string | null;
          appointment_id: string;
          created_at: string;
          id: string;
          outcome: string | null;
          service_commitment_id: string;
          status: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          actual_end_at?: string | null;
          actual_performer_id?: string | null;
          actual_start_at?: string | null;
          appointment_id: string;
          created_at?: string;
          id?: string;
          outcome?: string | null;
          service_commitment_id: string;
          status?: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          actual_end_at?: string | null;
          actual_performer_id?: string | null;
          actual_start_at?: string | null;
          appointment_id?: string;
          created_at?: string;
          id?: string;
          outcome?: string | null;
          service_commitment_id?: string;
          status?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type BeautyH8Tables = BeautyH8Database['public']['Tables'];
export type BeautyH8TableName = keyof BeautyH8Tables;
