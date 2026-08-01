/**
 * Bella EIP — Generic Resource DB Service (Supabase Persistence Layer)
 * Safely persists and retrieves Resource Snapshots, Assignments, SLA Logs, Rotations, and Audit Events
 */

import { supabase as typedSupabase } from '@/lib/supabase';
const supabase = typedSupabase as any;
import {
  ResourceRef,
  ResourceSnapshot,
  UniversalExecutionContext,
} from './types';

export class ResourceDBService {
  /**
   * Save or Update a CQRS-Lite Resource Snapshot in Supabase
   */
  public async upsertSnapshot(
    snapshot: ResourceSnapshot,
    context?: UniversalExecutionContext
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const payload = {
        tenant_id: snapshot.resource.tenantId,
        resource_type: snapshot.resource.resourceType,
        resource_id: snapshot.resource.resourceId,
        state: snapshot.workflow.state,
        workflow_state: snapshot.workflow.workflowState,
        owner_id: snapshot.assignment.ownerId || null,
        owner_name: snapshot.assignment.ownerName || null,
        current_stage: snapshot.sla.currentStage,
        current_sla_status: snapshot.sla.currentSLAStatus,
        attempt_count: snapshot.workflow.attemptCount,
        rotation_count: 0,
        version_binding: { workflowVersion: 'v1.0', ruleVersion: 'v1.0', slaVersion: 'v1.0' },
        updated_at: snapshot.updatedAt || new Date().toISOString(),
      };

      const { error } = await supabase
        .from('resource_snapshots')
        .upsert(payload, { onConflict: 'tenant_id,resource_type,resource_id' });

      if (error) {
        if (context?.services?.logger) {
          context.services.logger('error', 'Failed to upsert resource_snapshot: %s', error.message);
        }
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /**
   * Log an Assignment Record to Supabase
   */
  public async logAssignment(
    resource: ResourceRef,
    assignedToId: string,
    assignedToName: string,
    assignedById: string,
    assignedByName: string,
    status: 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'ROTATED' | 'REJECTED' = 'PENDING_ACCEPTANCE'
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const payload = {
        tenant_id: resource.tenantId,
        resource_type: resource.resourceType,
        resource_id: resource.resourceId,
        assigned_to: assignedToId,
        assigned_to_name: assignedToName,
        assigned_by: assignedById,
        assigned_at: new Date().toISOString(),
        status,
      };

      const { data, error } = await supabase
        .from('resource_assignments')
        .insert(payload)
        .select('id')
        .single();

      if (error) return { success: false, error: error.message };
      return { success: true, id: data?.id };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /**
   * Log a Rotation Audit Record to Supabase
   */
  public async logRotation(
    resource: ResourceRef,
    fromOwnerId: string | undefined,
    toOwnerId: string,
    reason: string,
    attemptCount: number = 1
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const payload = {
        tenant_id: resource.tenantId,
        resource_type: resource.resourceType,
        resource_id: resource.resourceId,
        from_owner_id: fromOwnerId || null,
        to_owner_id: toOwnerId,
        reason,
        attempt_count: attemptCount,
        rotated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('resource_rotations').insert(payload);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /**
   * Log an Audit Event Record to Supabase
   */
  public async logAuditEvent(
    resource: ResourceRef,
    eventType: string,
    actorId: string,
    actorName: string,
    description: string,
    payload: Record<string, unknown> = {},
    eventVersion: number = 1
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const eventPayload = {
        tenant_id: resource.tenantId,
        resource_type: resource.resourceType,
        resource_id: resource.resourceId,
        event_type: eventType,
        event_version: eventVersion,
        actor_id: actorId,
        actor_name: actorName,
        description,
        payload,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('resource_audit_logs').insert(eventPayload);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }
}

export const resourceDBService = new ResourceDBService();
