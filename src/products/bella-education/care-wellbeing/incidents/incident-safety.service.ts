import { SupabaseClient } from "@supabase/supabase-js";
import {
  ICloseIncidentCommand,
  IEscalateIncidentCommand,
  IIncidentSafetyContract,
  IReportIncidentCommand,
} from "./incident-safety.contract";

export class IncidentSafetyService implements IIncidentSafetyContract {
  constructor(private readonly supabase: SupabaseClient) {}

  async reportIncident(
    command: IReportIncidentCommand
  ): Promise<{ incidentId: string; escalationRequired: boolean }> {
    const escalationRequired = command.severity === "SEVERE" || command.severity === "CRITICAL";

    const { data, error } = await this.supabase
      .from("edu_health_incidents")
      .insert({
        tenant_id: command.tenantId,
        student_id: command.studentId,
        incident_time: command.incidentTime.toISOString(),
        incident_type: command.incidentType,
        severity: command.severity,
        description: command.description,
        action_taken: command.actionTaken,
        actor_id: command.actorId,
        escalation_required: escalationRequired,
        status: "OPEN",
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(`Failed to report incident: ${error.message}`);
    }

    return {
      incidentId: data.id,
      escalationRequired,
    };
  }

  async recordEscalationNotification(command: IEscalateIncidentCommand): Promise<void> {
    const { error } = await this.supabase
      .from("edu_health_incidents")
      .update({
        parent_notified_at: command.notifiedAt.toISOString(),
      })
      .eq("id", command.incidentId)
      .eq("tenant_id", command.tenantId);

    if (error) {
      throw new Error(`Failed to record escalation: ${error.message}`);
    }
  }

  async closeIncident(command: ICloseIncidentCommand): Promise<void> {
    // 1. Fetch current incident
    const { data: incident, error: fetchErr } = await this.supabase
      .from("edu_health_incidents")
      .select("escalation_required, escalation_acknowledged_at")
      .eq("id", command.incidentId)
      .eq("tenant_id", command.tenantId)
      .single();

    if (fetchErr || !incident) {
      throw new Error("Incident not found.");
    }

    // 2. Domain logic invariant for escalation closure
    if (incident.escalation_required) {
      const hasAck = incident.escalation_acknowledged_at || command.acknowledgedAt;
      if (!hasAck) {
        throw new Error(
          "INCIDENT_CLOSURE_VIOLATION: Cannot close a critical/severe incident without parent acknowledgement evidence."
        );
      }
    }

    // 3. Close the incident
    const updateData: any = { status: "CLOSED" };
    if (command.acknowledgedAt) {
      updateData.escalation_acknowledged_at = command.acknowledgedAt.toISOString();
    }
    if (command.escalationNotes) {
      updateData.escalation_notes = command.escalationNotes;
    }

    const { error: updateErr } = await this.supabase
      .from("edu_health_incidents")
      .update(updateData)
      .eq("id", command.incidentId)
      .eq("tenant_id", command.tenantId);

    if (updateErr) {
      // The DB constraint `check_incident_closure` will also catch this and throw
      if (updateErr.message.includes("check_incident_closure")) {
        throw new Error("INCIDENT_CLOSURE_VIOLATION: Database constraint blocked closure without escalation.");
      }
      throw new Error(`Failed to close incident: ${updateErr.message}`);
    }
  }
}
