/**
 * Bella Auto Phase 10 - Mobile Session Service
 * 
 * Manages mobile user sessions for PWA/mobile apps.
 * 
 * Features:
 * - Session creation with device info
 * - Location tracking for check-in
 * - Offline mode detection
 * - Session heartbeat
 * - Analytics tracking
 * 
 * @module bella-auto/services/mobile/MobileSessionService
 */

import { getPrimaryClient } from '@/lib/database/read-replica';
import { Database } from '@/types/database.types';

type MobileSession = Database['public']['Tables']['auto_mobile_sessions']['Row'];
type MobileSessionInsert = Database['public']['Tables']['auto_mobile_sessions']['Insert'];
type MobileSessionUpdate = Database['public']['Tables']['auto_mobile_sessions']['Update'];

type UserRole = 'sales' | 'service_advisor' | 'technician' | 'manager';
type DeviceType = 'ios' | 'android' | 'web' | 'pwa';
type NetworkType = 'wifi' | '4g' | '5g' | 'offline';

interface CreateSessionParams {
  tenantId: string;
  userId: string;
  userRole: UserRole;
  deviceId: string;
  deviceType?: DeviceType;
  deviceModel?: string;
  deviceOsVersion?: string;
  appVersion?: string;
  locationLat?: number;
  locationLng?: number;
  locationAccuracy?: number;
  locationName?: string;
  networkType?: NetworkType;
  userAgent?: string;
  ipAddress?: string;
}

interface UpdateLocationParams {
  sessionId: string;
  tenantId: string;
  locationLat: number;
  locationLng: number;
  locationAccuracy?: number;
  locationName?: string;
}

export class MobileSessionService {
  /**
   * Generate unique session token
   */
  private static generateSessionToken(): string {
    return `mob_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
  
  /**
   * Create new mobile session
   */
  static async createSession(params: CreateSessionParams): Promise<MobileSession> {
    const supabase = getPrimaryClient();
    
    const sessionToken = this.generateSessionToken();
    
    const sessionData: MobileSessionInsert = {
      tenant_id: params.tenantId,
      user_id: params.userId,
      user_role: params.userRole,
      device_id: params.deviceId,
      device_type: params.deviceType,
      device_model: params.deviceModel,
      device_os_version: params.deviceOsVersion,
      app_version: params.appVersion,
      session_token: sessionToken,
      location_lat: params.locationLat,
      location_lng: params.locationLng,
      location_accuracy: params.locationAccuracy,
      location_name: params.locationName,
      network_type: params.networkType || 'wifi',
      is_offline_mode: params.networkType === 'offline',
      user_agent: params.userAgent,
      ip_address: params.ipAddress,
      started_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
    };
    
    const { data, error } = await supabase
      .from('auto_mobile_sessions')
      .insert(sessionData)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create mobile session: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Get active session by token
   */
  static async getByToken(sessionToken: string, tenantId: string): Promise<MobileSession | null> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_mobile_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .eq('tenant_id', tenantId)
      .is('ended_at', null)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch session: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Get active session by user
   */
  static async getActiveByUser(userId: string, tenantId: string): Promise<MobileSession | null> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_mobile_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      throw new Error(`Failed to fetch active session: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Update session heartbeat (keep-alive)
   */
  static async heartbeat(
    sessionId: string,
    tenantId: string,
    networkType?: NetworkType
  ): Promise<MobileSession> {
    const supabase = getPrimaryClient();
    
    const updates: MobileSessionUpdate = {
      last_active_at: new Date().toISOString(),
    };
    
    if (networkType) {
      updates.network_type = networkType;
      updates.is_offline_mode = networkType === 'offline';
    }
    
    const { data, error } = await supabase
      .from('auto_mobile_sessions')
      .update(updates)
      .eq('id', sessionId)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update session heartbeat: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Update session location
   */
  static async updateLocation(params: UpdateLocationParams): Promise<MobileSession> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_mobile_sessions')
      .update({
        location_lat: params.locationLat,
        location_lng: params.locationLng,
        location_accuracy: params.locationAccuracy,
        location_name: params.locationName,
        last_active_at: new Date().toISOString(),
      })
      .eq('id', params.sessionId)
      .eq('tenant_id', params.tenantId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update session location: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * End session
   */
  static async endSession(sessionId: string, tenantId: string): Promise<MobileSession> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_mobile_sessions')
      .update({
        ended_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to end session: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Get session statistics
   */
  static async getStatistics(tenantId: string, dateRange?: { start: string; end: string }) {
    const supabase = getPrimaryClient();
    
    let query = supabase
      .from('auto_mobile_sessions')
      .select('user_role, device_type, network_type, started_at, ended_at')
      .eq('tenant_id', tenantId);
    
    if (dateRange) {
      query = query
        .gte('started_at', dateRange.start)
        .lte('started_at', dateRange.end);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch session statistics: ${error.message}`);
    }
    
    const stats = {
      totalSessions: data.length,
      activeSessions: 0,
      byRole: {} as Record<string, number>,
      byDevice: {} as Record<string, number>,
      byNetwork: {} as Record<string, number>,
      averageSessionDuration: 0,
    };
    
    let totalDuration = 0;
    let sessionsWithDuration = 0;
    
    data.forEach(session => {
      // Count by role
      stats.byRole[session.user_role] = (stats.byRole[session.user_role] || 0) + 1;
      
      // Count by device
      if (session.device_type) {
        stats.byDevice[session.device_type] = (stats.byDevice[session.device_type] || 0) + 1;
      }
      
      // Count by network
      if (session.network_type) {
        stats.byNetwork[session.network_type] = (stats.byNetwork[session.network_type] || 0) + 1;
      }
      
      // Active sessions
      if (!session.ended_at) {
        stats.activeSessions++;
      }
      
      // Average duration
      if (session.ended_at) {
        const duration = new Date(session.ended_at).getTime() - new Date(session.started_at).getTime();
        totalDuration += duration;
        sessionsWithDuration++;
      }
    });
    
    stats.averageSessionDuration = sessionsWithDuration > 0 
      ? Math.round(totalDuration / sessionsWithDuration / 1000 / 60) // minutes
      : 0;
    
    return stats;
  }
  
  /**
   * Cleanup old ended sessions (retention policy)
   */
  static async cleanupOldSessions(tenantId: string, daysToKeep: number = 90): Promise<number> {
    const supabase = getPrimaryClient();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const { data, error } = await supabase
      .from('auto_mobile_sessions')
      .delete()
      .eq('tenant_id', tenantId)
      .not('ended_at', 'is', null)
      .lt('ended_at', cutoffDate.toISOString())
      .select();
    
    if (error) {
      throw new Error(`Failed to cleanup old sessions: ${error.message}`);
    }
    
    return data?.length || 0;
  }
  
  /**
   * Get active sessions by role (for monitoring)
   */
  static async getActiveByRole(role: UserRole, tenantId: string): Promise<MobileSession[]> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_mobile_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_role', role)
      .is('ended_at', null)
      .order('last_active_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch active sessions by role: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Get active sessions at location (showroom/workshop)
   */
  static async getActiveAtLocation(
    tenantId: string,
    locationName: string
  ): Promise<MobileSession[]> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_mobile_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('location_name', locationName)
      .is('ended_at', null)
      .order('last_active_at', { ascending: false});
    
    if (error) {
      throw new Error(`Failed to fetch sessions at location: ${error.message}`);
    }
    
    return data || [];
  }
}
