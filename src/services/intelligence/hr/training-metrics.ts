/**
 * HR Intelligence - Training Metrics
 * 
 * Calculates training and skill development metrics for KTVs.
 * 
 * Note: Since training_courses/training_classes tables don't exist yet,
 * we calculate training metrics based on:
 * - Session completion rates (proxy for on-the-job training)
 * - Performance improvement over time
 * - Skill development through customer ratings
 * - Cross-training (KTVs covering different service types)
 * 
 * When proper training tables are added, this module should be refactored to:
 * - Query training_courses, training_classes, training_enrollments
 * - Calculate actual course completion rates
 * - Track formal certification progress
 */

import { createClient } from '@/lib/supabase-server';
import type { DateRange, TimePeriod } from '../shared/types';
import { QueryError } from '../shared/types';
import { parseDateRange, formatDate } from '../shared/helpers';

// ─── Type Definitions ───────────────────────────────────────────────────────

/**
 * Training Metrics
 */
export interface TrainingMetrics {
  tenantId: string;
  period: string;
  ktvId: string;
  ktvName: string;
  
  // On-the-job training metrics (from sessions)
  totalSessionsCompleted: number;
  uniqueServiceTypes: number; // Cross-training indicator
  avgSessionQualityScore: number; // Customer ratings average
  
  // Performance improvement
  performanceImprovementPct: number; // Month-over-month rating improvement
  skillDevelopmentScore: number; // Composite: quality + variety + improvement
  
  // Training hours (estimated from session duration)
  estimatedTrainingHours: number;
  trainingHoursPerWeek: number;
  
  // Competency indicators
  serviceCompetencyLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  crossTrainingReadiness: boolean; // Can handle multiple service types
  
  // ROI proxy (performance vs cost)
  revenueContribution: number;
  trainingROI: number; // Revenue / (estimated training cost)
  
  // Metadata
  periodStart: string;
  periodEnd: string;
  computedAt: string;
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Calculate competency level based on sessions and quality
 */
function calculateCompetencyLevel(
  totalSessions: number,
  avgQuality: number
): 'beginner' | 'intermediate' | 'advanced' | 'expert' {
  if (totalSessions >= 100 && avgQuality >= 4.5) return 'expert';
  if (totalSessions >= 50 && avgQuality >= 4.0) return 'advanced';
  if (totalSessions >= 20 && avgQuality >= 3.5) return 'intermediate';
  return 'beginner';
}

/**
 * Calculate skill development score (0-100)
 */
function calculateSkillScore(
  totalSessions: number,
  uniqueServices: number,
  avgQuality: number,
  improvement: number
): number {
  const volumeScore = Math.min(totalSessions / 100, 1) * 30; // Max 30 points
  const varietyScore = Math.min(uniqueServices / 5, 1) * 20; // Max 20 points
  const qualityScore = (avgQuality / 5) * 30; // Max 30 points
  const improvementScore = Math.max(0, Math.min(improvement / 20, 1)) * 20; // Max 20 points
  
  return Math.round(volumeScore + varietyScore + qualityScore + improvementScore);
}

// ─── Query Functions ────────────────────────────────────────────────────────

/**
 * Get Training Metrics
 * 
 * Calculates training and skill development metrics for KTVs based on
 * session completion, quality ratings, and performance trends.
 * 
 * @param tenantId - Tenant ID
 * @param dateRange - Period to analyze (or TimePeriod string)
 * @returns Array of training metrics by KTV
 */
export async function getTrainingMetrics(
  tenantId: string,
  dateRange?: DateRange | TimePeriod
): Promise<TrainingMetrics[]> {
  const supabase = await createClient();
  
  try {
    // Parse date range
    const range = dateRange 
      ? (typeof dateRange === 'string' 
          ? parseDateRange(dateRange as TimePeriod)
          : parseDateRange(dateRange as DateRange))
      : {
          startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          endDate: new Date()
        };
    
    // Ensure dates are Date objects, not strings
    const startDate = typeof range.startDate === 'string' ? new Date(range.startDate) : range.startDate;
    const endDate = typeof range.endDate === 'string' ? new Date(range.endDate) : range.endDate;
    
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);
    
    // Get previous period for comparison (same duration)
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - periodDays + 1);
    
    const prevStartDateStr = formatDate(prevStartDate);
    const prevEndDateStr = formatDate(prevEndDate);
    
    // Query current period sessions with ratings
    // Note: customer_rating field may not exist yet in session_logs
    // If missing, we'll use dummy data or fallback to 0
    const { data: currentSessionsData, error: currentError } = await supabase
      .from('session_logs')
      .select(`
        id,
        completed_by_ktv_id,
        completed_date,
        bookings!inner(
          id,
          tenant_id,
          package_name,
          ktv_commission,
          packages(service_category)
        ),
        users!session_logs_completed_by_ktv_id_fkey(
          id,
          full_name
        )
      `)
      .eq('bookings.tenant_id', tenantId)
      .eq('status', 'completed')
      .gte('completed_date', startDateStr)
      .lte('completed_date', endDateStr)
      .not('completed_by_ktv_id', 'is', null);
    
    if (currentError) {
      throw new QueryError(
        `Failed to query current period sessions: ${currentError.message}`,
        currentError
      );
    }
    
    // Type-cast to proper interface
    type SessionLog = {
      id: string;
      completed_by_ktv_id: string;
      completed_date: string;
      bookings: {
        id: string;
        tenant_id: string;
        package_name: string | null;
        ktv_commission: number | null;
        packages: {
          service_category: string | null;
        } | null;
      } | null;
      users: {
        id: string;
        full_name: string | null;
      } | null;
    };
    
    const currentSessions: SessionLog[] = (currentSessionsData || []) as unknown as SessionLog[];
    
    // Query previous period sessions for comparison
    const { data: prevSessionsData, error: prevError } = await supabase
      .from('session_logs')
      .select(`
        id,
        completed_by_ktv_id,
        completed_date
      `)
      .eq('bookings.tenant_id', tenantId)
      .eq('status', 'completed')
      .gte('completed_date', prevStartDateStr)
      .lte('completed_date', prevEndDateStr)
      .not('completed_by_ktv_id', 'is', null);
    
    if (prevError) {
      console.warn('[TrainingMetrics] Failed to query previous period:', prevError.message);
    }
    
    type PrevSessionLog = {
      id: string;
      completed_by_ktv_id: string;
      completed_date: string;
    };
    
    const prevSessions: PrevSessionLog[] = (prevSessionsData || []) as unknown as PrevSessionLog[];
    
    // Group sessions by KTV
    const ktvMap = new Map<string, {
      ktvId: string;
      ktvName: string;
      sessions: SessionLog[];
      ratings: number[];
      serviceTypes: Set<string>;
      revenue: number;
    }>();
    
    currentSessions.forEach((session) => {
      const ktvId = session.completed_by_ktv_id;
      const ktvName = session.users?.full_name || 'Unknown';
      const rating = 0; // TODO: Add customer_rating field to session_logs table
      const serviceType = session.bookings?.packages?.service_category || 'other';
      const revenue = session.bookings?.ktv_commission || 0;
      
      if (!ktvMap.has(ktvId)) {
        ktvMap.set(ktvId, {
          ktvId,
          ktvName,
          sessions: [],
          ratings: [],
          serviceTypes: new Set(),
          revenue: 0
        });
      }
      
      const ktv = ktvMap.get(ktvId)!;
      ktv.sessions.push(session);
      if (rating > 0) ktv.ratings.push(rating);
      ktv.serviceTypes.add(serviceType);
      ktv.revenue += revenue;
    });
    
    // Calculate previous period average ratings for each KTV
    // TODO: When customer_rating field is added to session_logs, uncomment this section
    const prevRatingsMap = new Map<string, number>();
    const prevAvgRatings = new Map<string, number>();
    
    // For now, use dummy data since customer_rating doesn't exist yet
    /* prevSessions.forEach((session) => {
      const ktvId = session.completed_by_ktv_id;
      const rating = 0; // TODO: Add customer_rating field
      
      if (rating > 0) {
        const ratings = prevRatingsMap.get(ktvId) || [];
        prevRatingsMap.set(ktvId, rating);
      }
    });
    
    const prevRatingCounts = new Map<string, number[]>();
    prevSessions.forEach((session) => {
      const ktvId = session.completed_by_ktv_id;
      const rating = 0; // TODO: Add customer_rating field
      if (rating > 0) {
        if (!prevRatingCounts.has(ktvId)) {
          prevRatingCounts.set(ktvId, []);
        }
        prevRatingCounts.get(ktvId)!.push(rating);
      }
    });
    */
    
    // TODO: Uncomment when customer_rating is available
    /* prevRatingCounts.forEach((ratings, ktvId) => {
      const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
      prevAvgRatings.set(ktvId, avg);
    }); */
    
    // Build training metrics
    const metrics: TrainingMetrics[] = [];
    const computedAt = new Date().toISOString();
    
    ktvMap.forEach((ktv) => {
      const totalSessions = ktv.sessions.length;
      const avgQuality = ktv.ratings.length > 0
        ? ktv.ratings.reduce((sum, r) => sum + r, 0) / ktv.ratings.length
        : 0;
      const prevAvgQuality = prevAvgRatings.get(ktv.ktvId) || avgQuality;
      const performanceImprovement = prevAvgQuality > 0
        ? ((avgQuality - prevAvgQuality) / prevAvgQuality) * 100
        : 0;
      
      const uniqueServiceTypes = ktv.serviceTypes.size;
      const skillScore = calculateSkillScore(
        totalSessions,
        uniqueServiceTypes,
        avgQuality,
        performanceImprovement
      );
      
      // Estimate training hours (assume 90 min per session avg)
      const estimatedHours = (totalSessions * 1.5);
      const weeksDuration = periodDays / 7;
      const hoursPerWeek = weeksDuration > 0 ? estimatedHours / weeksDuration : 0;
      
      // Calculate training ROI (revenue / estimated training cost)
      const estimatedTrainingCost = estimatedHours * 50000; // Assume 50k VND/hour training cost
      const roi = estimatedTrainingCost > 0 ? (ktv.revenue / estimatedTrainingCost) * 100 : 0;
      
      metrics.push({
        tenantId,
        period: `${startDateStr}_to_${endDateStr}`,
        ktvId: ktv.ktvId,
        ktvName: ktv.ktvName,
        
        totalSessionsCompleted: totalSessions,
        uniqueServiceTypes,
        avgSessionQualityScore: Math.round(avgQuality * 10) / 10,
        
        performanceImprovementPct: Math.round(performanceImprovement * 10) / 10,
        skillDevelopmentScore: skillScore,
        
        estimatedTrainingHours: Math.round(estimatedHours * 10) / 10,
        trainingHoursPerWeek: Math.round(hoursPerWeek * 10) / 10,
        
        serviceCompetencyLevel: calculateCompetencyLevel(totalSessions, avgQuality),
        crossTrainingReadiness: uniqueServiceTypes >= 3,
        
        revenueContribution: ktv.revenue,
        trainingROI: Math.round(roi * 10) / 10,
        
        periodStart: startDateStr,
        periodEnd: endDateStr,
        computedAt
      });
    });
    
    // Sort by skill development score descending
    metrics.sort((a, b) => b.skillDevelopmentScore - a.skillDevelopmentScore);
    
    return metrics;
    
  } catch (error) {
    if (error instanceof QueryError) {
      throw error;
    }
    
    throw new QueryError(
      `Failed to calculate training metrics: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }
}
