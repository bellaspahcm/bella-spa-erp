import { SupabaseClient } from "@supabase/supabase-js";
import {
  IAdministerDoseCommand,
  IMedicationSafetyContract,
  IMedicationAuthorization,
  IMedicationDoseOccurrence,
} from "./medication-safety.contract";

export class MedicationSafetyService implements IMedicationSafetyContract {
  constructor(private readonly supabase: SupabaseClient) {}

  async administerDose(command: IAdministerDoseCommand): Promise<{ logId: string; status: "COMPLETED" }> {
    // 1. Fetch Authorization & Occurrence together
    const { data: occurrence, error: occErr } = await this.supabase
      .from("edu_medication_dose_occurrences")
      .select(`
        *,
        authorization:authorization_id (*)
      `)
      .eq("id", command.doseOccurrenceId)
      .eq("tenant_id", command.tenantId)
      .single();

    if (occErr || !occurrence) {
      throw new Error("MEDICATION_DOSE_NOT_FOUND: Dose occurrence not found.");
    }

    const auth = occurrence.authorization as IMedicationAuthorization;

    // 2. Student ID Match
    if (auth.student_id !== command.studentId) {
      throw new Error("MEDICATION_STUDENT_MISMATCH: Dose does not belong to this student.");
    }

    // 3. Authorization status
    if (auth.status !== "ACTIVE") {
      throw new Error(`MEDICATION_AUTH_INVALID_ERROR: Authorization is ${auth.status}, expected ACTIVE.`);
    }

    // 4. Authorization date boundaries
    const now = new Date(command.administeredAt);
    const validFrom = new Date(auth.valid_from);
    const validUntil = new Date(auth.valid_until);

    if (now < validFrom || now > validUntil) {
      throw new Error("MEDICATION_AUTH_EXPIRED_ERROR: Current time is outside authorization valid dates.");
    }

    // 5. Dose Window Boundary Check (Domain level)
    const windowStart = new Date(occurrence.window_start);
    const windowEnd = new Date(occurrence.window_end);

    if (now < windowStart || now > windowEnd) {
      throw new Error("MEDICATION_WINDOW_VIOLATION: Attempting to administer outside allowed dose window.");
    }

    // 6. DB Insertion (Relies on unique constraint to catch race condition double dose)
    const { data: log, error: logErr } = await this.supabase
      .from("edu_medication_logs")
      .insert({
        tenant_id: command.tenantId,
        dose_occurrence_id: command.doseOccurrenceId,
        administered_at: command.administeredAt.toISOString(),
        dose_given: command.doseGiven,
        actor_id: command.actorId,
        status: "COMPLETED",
        notes: command.notes,
      })
      .select("id")
      .single();

    if (logErr) {
      // Catch Unique Constraint Violation (uq_completed_medication_dose)
      // Code 23505 is PostgreSQL's unique_violation
      if (logErr.code === "23505" || logErr.message.includes("uq_completed_medication_dose") || logErr.message.includes("duplicate key")) {
        throw new Error("MEDICATION_DOUBLE_DOSE_ERROR: This dose has already been COMPLETED by another concurrent action.");
      }
      throw new Error(`MEDICATION_LOG_INSERT_ERROR: ${logErr.message}`);
    }

    // 7. Update Occurrence Status
    await this.supabase
      .from("edu_medication_dose_occurrences")
      .update({ status: "COMPLETED" })
      .eq("id", command.doseOccurrenceId);

    return { logId: log.id, status: "COMPLETED" };
  }
}
