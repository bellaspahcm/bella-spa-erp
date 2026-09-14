/**
 * E5 — English Center Timetable Repository
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  ClassScheduleContext,
  ClassSessionRow,
  CreateRoomInput,
  EnglishCenterClassSession,
  EnglishCenterRoom,
  EnglishCenterSessionStatus,
  RoomRow,
  ScheduleClassSessionInput,
  TimetableListFilters,
  UpdateClassSessionInput,
  UpdateRoomInput,
} from '../types/timetable.types';

type ClassContextRow = {
  id: string;
  tenant_id: string;
  branch_id: string;
  capacity: number;
  teacher_id: string | null;
};

type TeacherBranchRow = {
  teacher_id: string;
};

export class TimetableRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async createRoom(tenantId: string, input: CreateRoomInput): Promise<EnglishCenterRoom> {
    const { data: row, error } = await this.supabase
      .from('english_center_rooms')
      .insert({
        tenant_id: tenantId,
        branch_id: input.branchId,
        code: input.code,
        name: input.name,
        capacity: input.capacity || 20,
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapRoomRow(row as RoomRow);
  }

  async getRoomById(tenantId: string, roomId: string): Promise<EnglishCenterRoom | null> {
    const { data: row, error } = await this.supabase
      .from('english_center_rooms')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', roomId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapRoomRow(row as RoomRow);
  }

  async listRooms(
    tenantId: string,
    filters?: {
      branchId?: string;
      status?: 'active' | 'inactive';
      limit?: number;
      offset?: number;
    }
  ): Promise<{ rooms: EnglishCenterRoom[]; total: number }> {
    let query = this.supabase
      .from('english_center_rooms')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (filters?.branchId) query = query.eq('branch_id', filters.branchId);
    if (filters?.status) query = query.eq('status', filters.status);

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    const { data: rows, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('name');

    if (error) throw error;

    return {
      rooms: (rows || []).map((row) => this.mapRoomRow(row as RoomRow)),
      total: count || 0,
    };
  }

  async updateRoom(
    tenantId: string,
    roomId: string,
    input: UpdateRoomInput
  ): Promise<EnglishCenterRoom> {
    const updateData: Partial<RoomRow> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.capacity !== undefined) updateData.capacity = input.capacity;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;

    const { data: row, error } = await this.supabase
      .from('english_center_rooms')
      .update(updateData)
      .eq('tenant_id', tenantId)
      .eq('id', roomId)
      .select()
      .single();

    if (error) throw error;
    return this.mapRoomRow(row as RoomRow);
  }

  async getClassContext(
    tenantId: string,
    classId: string
  ): Promise<ClassScheduleContext | null> {
    const { data: row, error } = await this.supabase
      .from('english_center_classes')
      .select('id, tenant_id, branch_id, capacity, teacher_id')
      .eq('tenant_id', tenantId)
      .eq('id', classId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    const classRow = row as ClassContextRow;
    return {
      id: classRow.id,
      tenantId: classRow.tenant_id,
      branchId: classRow.branch_id,
      capacity: classRow.capacity,
      teacherId: classRow.teacher_id,
    };
  }

  async teacherAssignedToBranch(
    tenantId: string,
    teacherId: string,
    branchId: string
  ): Promise<boolean> {
    const { data: row, error } = await this.supabase
      .from('english_center_teacher_branches')
      .select('teacher_id')
      .eq('tenant_id', tenantId)
      .eq('teacher_id', teacherId)
      .eq('branch_id', branchId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return Boolean(row as TeacherBranchRow | null);
  }

  async listOverlappingSessions(input: {
    tenantId: string;
    startsAt: string;
    endsAt: string;
    excludeSessionId?: string;
    status?: EnglishCenterSessionStatus;
  }): Promise<EnglishCenterClassSession[]> {
    let query = this.supabase
      .from('english_center_class_sessions')
      .select('*')
      .eq('tenant_id', input.tenantId)
      .eq('status', input.status || 'scheduled')
      .lt('starts_at', input.endsAt)
      .gt('ends_at', input.startsAt);

    if (input.excludeSessionId) {
      query = query.neq('id', input.excludeSessionId);
    }

    const { data: rows, error } = await query;

    if (error) throw error;
    return (rows || []).map((row) => this.mapSessionRow(row as ClassSessionRow));
  }

  async createSession(
    tenantId: string,
    input: ScheduleClassSessionInput
  ): Promise<EnglishCenterClassSession> {
    const { data: row, error } = await this.supabase
      .from('english_center_class_sessions')
      .insert({
        tenant_id: tenantId,
        branch_id: input.branchId,
        class_id: input.classId,
        teacher_id: input.teacherId || null,
        room_id: input.roomId || null,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        topic: input.topic || null,
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapSessionRow(row as ClassSessionRow);
  }

  async getSessionById(
    tenantId: string,
    sessionId: string
  ): Promise<EnglishCenterClassSession | null> {
    const { data: row, error } = await this.supabase
      .from('english_center_class_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapSessionRow(row as ClassSessionRow);
  }

  async listSessions(
    tenantId: string,
    filters?: TimetableListFilters
  ): Promise<{ sessions: EnglishCenterClassSession[]; total: number }> {
    let query = this.supabase
      .from('english_center_class_sessions')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (filters?.branchId) query = query.eq('branch_id', filters.branchId);
    if (filters?.classId) query = query.eq('class_id', filters.classId);
    if (filters?.teacherId) query = query.eq('teacher_id', filters.teacherId);
    if (filters?.roomId) query = query.eq('room_id', filters.roomId);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.from) query = query.gte('ends_at', filters.from);
    if (filters?.to) query = query.lte('starts_at', filters.to);

    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;
    const { data: rows, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('starts_at', { ascending: true });

    if (error) throw error;

    return {
      sessions: (rows || []).map((row) => this.mapSessionRow(row as ClassSessionRow)),
      total: count || 0,
    };
  }

  async updateSession(
    tenantId: string,
    sessionId: string,
    input: UpdateClassSessionInput
  ): Promise<EnglishCenterClassSession> {
    const updateData: Partial<ClassSessionRow> = {};

    if (input.teacherId !== undefined) updateData.teacher_id = input.teacherId || null;
    if (input.roomId !== undefined) updateData.room_id = input.roomId || null;
    if (input.startsAt !== undefined) updateData.starts_at = input.startsAt;
    if (input.endsAt !== undefined) updateData.ends_at = input.endsAt;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.topic !== undefined) updateData.topic = input.topic || null;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;

    const { data: row, error } = await this.supabase
      .from('english_center_class_sessions')
      .update(updateData)
      .eq('tenant_id', tenantId)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return this.mapSessionRow(row as ClassSessionRow);
  }

  private mapRoomRow(row: RoomRow): EnglishCenterRoom {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      code: row.code,
      name: row.name,
      capacity: row.capacity,
      status: row.status,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapSessionRow(row: ClassSessionRow): EnglishCenterClassSession {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      classId: row.class_id,
      teacherId: row.teacher_id,
      roomId: row.room_id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
      topic: row.topic,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
