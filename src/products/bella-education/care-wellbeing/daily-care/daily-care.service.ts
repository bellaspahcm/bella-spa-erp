import { SupabaseClient } from "@supabase/supabase-js";
import {
  IDailyCareContract,
  IBulkCareResult,
  IRecordBulkArrivalCommand,
  IRecordBulkMealCommand,
  IRecordBulkHygieneCommand,
  IRecordBulkNapCommand,
  IParentDigest,
} from "./daily-care.contract";
import { AllergySafetyService } from "../health-profile/allergy-safety.service";

export class DailyCareService implements IDailyCareContract {
  private allergySafetyService: AllergySafetyService;

  constructor(private readonly supabase: SupabaseClient) {
    this.allergySafetyService = new AllergySafetyService(supabase);
  }

  private async getOrCreateSession(tenantId: string, classId: string, date: string): Promise<string> {
    const { data: existingSession } = await this.supabase
      .from("edu_daily_care_sessions")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("class_id", classId)
      .eq("date", date)
      .single();

    if (existingSession) {
      return existingSession.id;
    }

    const { data: newSession, error } = await this.supabase
      .from("edu_daily_care_sessions")
      .insert({ tenant_id: tenantId, class_id: classId, date: date })
      .select("id")
      .single();

    if (error) {
      throw new Error(`FAILED_TO_CREATE_CARE_SESSION: ${error.message}`);
    }

    return newSession.id;
  }

  private async getOrCreateStudentRecord(tenantId: string, sessionId: string, studentId: string): Promise<any> {
    const { data: existingRecord } = await this.supabase
      .from("edu_daily_care_records")
      .select("*")
      .eq("session_id", sessionId)
      .eq("student_id", studentId)
      .single();

    if (existingRecord) {
      return existingRecord;
    }

    const { data: newRecord, error } = await this.supabase
      .from("edu_daily_care_records")
      .insert({
        tenant_id: tenantId,
        session_id: sessionId,
        student_id: studentId,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`FAILED_TO_CREATE_STUDENT_CARE_RECORD: ${error.message}`);
    }

    return newRecord;
  }

  async recordBulkArrival(command: IRecordBulkArrivalCommand): Promise<IBulkCareResult> {
    const sessionId = await this.getOrCreateSession(command.tenantId, command.classId, command.date);
    const result: IBulkCareResult = {
      requested: command.arrivals.length,
      committed: 0,
      blocked: 0,
      successfulStudentIds: [],
      exceptions: [],
    };

    for (const arrival of command.arrivals) {
      try {
        const record = await this.getOrCreateStudentRecord(command.tenantId, sessionId, arrival.studentId);
        
        const { error } = await this.supabase
          .from("edu_daily_care_records")
          .update({
            arrival_status: arrival.status,
            arrival_time: arrival.arrivalTime?.toISOString() || new Date().toISOString(),
            morning_condition: arrival.condition || "GOOD",
            updated_at: new Date().toISOString(),
          })
          .eq("id", record.id);

        if (error) throw error;

        result.committed++;
        result.successfulStudentIds.push(arrival.studentId);
      } catch (err: any) {
        result.blocked++;
        result.exceptions.push({
          studentId: arrival.studentId,
          errorCode: "ARRIVAL_RECORD_FAILED",
          errorMessage: err.message || "Failed to record arrival",
          requiresAction: true,
        });
      }
    }

    return result;
  }

  async recordBulkMeals(command: IRecordBulkMealCommand): Promise<IBulkCareResult> {
    const sessionId = await this.getOrCreateSession(command.tenantId, command.classId, command.date);
    const result: IBulkCareResult = {
      requested: command.students.length,
      committed: 0,
      blocked: 0,
      successfulStudentIds: [],
      exceptions: [],
    };

    for (const studentMeal of command.students) {
      // 1. Mandatory P4.1 Safety Check
      try {
        await this.allergySafetyService.checkMealSafety({
          tenantId: command.tenantId,
          studentId: studentMeal.studentId,
          mealItemId: command.mealItemId,
        });
      } catch (safetyErr: any) {
        // Hard Block for allergic student
        result.blocked++;
        result.exceptions.push({
          studentId: studentMeal.studentId,
          errorCode: "ALLERGY_EXPOSURE_RISK",
          errorMessage: safetyErr.message,
          requiresAction: true,
        });
        continue; // Skip committing this child's meal
      }

      // 2. Commit meal record if safe
      try {
        const record = await this.getOrCreateStudentRecord(command.tenantId, sessionId, studentMeal.studentId);
        const existingMeals = Array.isArray(record.meal_records) ? record.meal_records : [];
        
        const newMealEntry = {
          mealItemId: command.mealItemId,
          mealType: command.mealType,
          portion: studentMeal.portion,
          notes: studentMeal.notes,
          recordedAt: new Date().toISOString(),
        };

        const { error } = await this.supabase
          .from("edu_daily_care_records")
          .update({
            meal_records: [...existingMeals, newMealEntry],
            updated_at: new Date().toISOString(),
          })
          .eq("id", record.id);

        if (error) throw error;

        result.committed++;
        result.successfulStudentIds.push(studentMeal.studentId);
      } catch (err: any) {
        result.blocked++;
        result.exceptions.push({
          studentId: studentMeal.studentId,
          errorCode: "MEAL_RECORD_FAILED",
          errorMessage: err.message || "Failed to commit meal record",
          requiresAction: true,
        });
      }
    }

    return result;
  }

  async recordBulkHygiene(command: IRecordBulkHygieneCommand): Promise<IBulkCareResult> {
    const sessionId = await this.getOrCreateSession(command.tenantId, command.classId, command.date);
    const result: IBulkCareResult = {
      requested: command.hygieneEntries.length,
      committed: 0,
      blocked: 0,
      successfulStudentIds: [],
      exceptions: [],
    };

    for (const entry of command.hygieneEntries) {
      try {
        const record = await this.getOrCreateStudentRecord(command.tenantId, sessionId, entry.studentId);
        const existingHygiene = Array.isArray(record.hygiene_records) ? record.hygiene_records : [];

        const newHygieneEntry = {
          type: entry.type,
          time: entry.time?.toISOString() || new Date().toISOString(),
          notes: entry.notes,
        };

        const { error } = await this.supabase
          .from("edu_daily_care_records")
          .update({
            hygiene_records: [...existingHygiene, newHygieneEntry],
            updated_at: new Date().toISOString(),
          })
          .eq("id", record.id);

        if (error) throw error;

        result.committed++;
        result.successfulStudentIds.push(entry.studentId);
      } catch (err: any) {
        result.blocked++;
        result.exceptions.push({
          studentId: entry.studentId,
          errorCode: "HYGIENE_RECORD_FAILED",
          errorMessage: err.message || "Failed to commit hygiene record",
          requiresAction: true,
        });
      }
    }

    return result;
  }

  async recordBulkNap(command: IRecordBulkNapCommand): Promise<IBulkCareResult> {
    const sessionId = await this.getOrCreateSession(command.tenantId, command.classId, command.date);
    const result: IBulkCareResult = {
      requested: command.napEntries.length,
      committed: 0,
      blocked: 0,
      successfulStudentIds: [],
      exceptions: [],
    };

    for (const entry of command.napEntries) {
      try {
        const record = await this.getOrCreateStudentRecord(command.tenantId, sessionId, entry.studentId);

        const napData = {
          sleepTime: entry.sleepTime?.toISOString(),
          wakeTime: entry.wakeTime?.toISOString(),
          quality: entry.quality,
          notes: entry.notes,
          updatedAt: new Date().toISOString(),
        };

        const { error } = await this.supabase
          .from("edu_daily_care_records")
          .update({
            nap_records: napData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", record.id);

        if (error) throw error;

        result.committed++;
        result.successfulStudentIds.push(entry.studentId);
      } catch (err: any) {
        result.blocked++;
        result.exceptions.push({
          studentId: entry.studentId,
          errorCode: "NAP_RECORD_FAILED",
          errorMessage: err.message || "Failed to commit nap record",
          requiresAction: true,
        });
      }
    }

    return result;
  }

  async generateParentDigest(tenantId: string, classId: string, studentId: string, date: string): Promise<IParentDigest> {
    const sessionId = await this.getOrCreateSession(tenantId, classId, date);
    const { data: record } = await this.supabase
      .from("edu_daily_care_records")
      .select("*")
      .eq("session_id", sessionId)
      .eq("student_id", studentId)
      .single();

    if (!record) {
      throw new Error("CARE_RECORD_NOT_FOUND: No care record found to generate digest.");
    }

    // Check existing digest
    const { data: existingDigest } = await this.supabase
      .from("edu_daily_parent_digests")
      .select("*")
      .eq("session_id", sessionId)
      .eq("student_id", studentId)
      .single();

    if (existingDigest && existingDigest.status === "PUBLISHED") {
      throw new Error("DIGEST_IMMUTABLE_ERROR: Cannot regenerate a PUBLISHED parent digest.");
    }

    // Construct derived projection payload
    const payload = {
      date,
      arrivalStatus: record.arrival_status,
      arrivalTime: record.arrival_time,
      morningCondition: record.morning_condition,
      meals: record.meal_records,
      hygiene: record.hygiene_records,
      nap: record.nap_records,
      healthChecks: record.health_checks,
      generatedAt: new Date().toISOString(),
    };

    if (existingDigest) {
      const { data: updated, error } = await this.supabase
        .from("edu_daily_parent_digests")
        .update({
          status: "GENERATED",
          digest_payload: payload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingDigest.id)
        .select("*")
        .single();

      if (error) throw error;
      return {
        digestId: updated.id,
        tenantId: updated.tenant_id,
        sessionId: updated.session_id,
        studentId: updated.student_id,
        date: updated.date,
        status: updated.status,
        payload: updated.digest_payload,
        publishedAt: updated.published_at,
      };
    }

    const { data: created, error } = await this.supabase
      .from("edu_daily_parent_digests")
      .insert({
        tenant_id: tenantId,
        session_id: sessionId,
        student_id: studentId,
        date,
        status: "GENERATED",
        digest_payload: payload,
      })
      .select("*")
      .single();

    if (error) throw error;

    return {
      digestId: created.id,
      tenantId: created.tenant_id,
      sessionId: created.session_id,
      studentId: created.student_id,
      date: created.date,
      status: created.status,
      payload: created.digest_payload,
      publishedAt: created.published_at,
    };
  }

  async publishParentDigest(tenantId: string, digestId: string): Promise<IParentDigest> {
    const { data: digest, error: fetchErr } = await this.supabase
      .from("edu_daily_parent_digests")
      .select("*")
      .eq("id", digestId)
      .eq("tenant_id", tenantId)
      .single();

    if (fetchErr || !digest) {
      throw new Error("DIGEST_NOT_FOUND: Parent digest not found.");
    }

    if (digest.status === "PUBLISHED") {
      return {
        digestId: digest.id,
        tenantId: digest.tenant_id,
        sessionId: digest.session_id,
        studentId: digest.student_id,
        date: digest.date,
        status: digest.status,
        payload: digest.digest_payload,
        publishedAt: digest.published_at,
      };
    }

    const { data: published, error } = await this.supabase
      .from("edu_daily_parent_digests")
      .update({
        status: "PUBLISHED",
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", digestId)
      .select("*")
      .single();

    if (error) throw error;

    return {
      digestId: published.id,
      tenantId: published.tenant_id,
      sessionId: published.session_id,
      studentId: published.student_id,
      date: published.date,
      status: published.status,
      payload: published.digest_payload,
      publishedAt: published.published_at,
    };
  }
}
