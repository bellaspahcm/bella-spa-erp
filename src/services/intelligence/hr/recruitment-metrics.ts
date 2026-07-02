/**
 * HR Intelligence - Recruitment Metrics
 * 
 * Calculates recruitment pipeline metrics, time-to-hire, cost-per-hire,
 * source effectiveness, and conversion rates.
 * 
 * Data Sources:
 * - recruitment_positions: Job openings
 * - recruitment_candidates: Applicant records
 * - recruitment_pipelines: Stage transition history
 * - recruitment_interviews: Interview feedback
 * 
 * Key Metrics:
 * - Pipeline conversion rates (screen → interview → offer → hire)
 * - Time-to-hire (average days from application to hire)
 * - Cost-per-hire (total recruitment cost / hires)
 * - Source effectiveness (which channels bring best candidates)
 * - New hire quality (90-day retention, average rating)
 */

import { createClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database.types';
import type { DateRange, TimePeriod } from '../shared/types';
import { QueryError } from '../shared/types';
import { parseDateRange, formatDate } from '../shared/helpers';

// ─── Type Definitions ───────────────────────────────────────────────────────

/**
 * Recruitment Candidate Record (from generated types)
 */
type RecruitmentCandidate = Database['public']['Tables']['recruitment_candidates']['Row'];

/**
 * Pipeline Transition Record (from generated types)
 */
type PipelineTransition = Database['public']['Tables']['recruitment_pipelines']['Row'];

/**
 * Interview Record (from generated types)
 */
type InterviewRecord = Database['public']['Tables']['recruitment_interviews']['Row'];

/**
 * User Record (for retention check)
 */
interface UserRecord {
  id: string;
  created_at: string;
  status: string;
}

/**
 * Recruitment Metrics
 */
export interface RecruitmentMetrics {
  tenantId: string;
  period: string;
  
  // Pipeline metrics
  totalApplications: number;
  applicationsInReview: number;
  applicationsInterviewed: number;
  applicationsOffered: number;
  applicationsHired: number;
  applicationsRejected: number;
  
  // Conversion rates
  screenToInterviewPct: number;
  interviewToOfferPct: number;
  offerToHirePct: number;
  overallConversionPct: number;
  
  // Time metrics
  avgTimeToHireDays: number;
  avgTimeToInterviewDays: number;
  avgTimeToOfferDays: number;
  
  // Cost metrics
  totalRecruitmentCost: number;
  costPerHire: number;
  costPerApplication: number;
  
  // Source effectiveness
  topSources: Array<{
    sourceName: string;
    applications: number;
    hires: number;
    conversionRate: number;
    costPerHire: number;
  }>;
  
  // Quality metrics
  newHireRetention90Days: number;
  avgNewHireRating: number;
  
  // Metadata
  periodStart: string;
  periodEnd: string;
  computedAt: string;
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date | string | null, date2: Date | string | null): number {
  if (!date1 || !date2) return 0;
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  return Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate percentage safely
 */
function safePct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10; // 1 decimal place
}

// ─── Query Functions ────────────────────────────────────────────────────────

/**
 * Get Recruitment Metrics
 * 
 * Calculates comprehensive recruitment metrics including pipeline conversion,
 * time-to-hire, cost-per-hire, and source effectiveness.
 * 
 * @param tenantId - Tenant ID
 * @param dateRange - Period to analyze (or TimePeriod string)
 * @returns Recruitment metrics summary
 */
export async function getRecruitmentMetrics(
  tenantId: string,
  dateRange?: DateRange | TimePeriod
): Promise<RecruitmentMetrics[]> {
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
    
    // Query candidates within date range
    const { data: candidatesData, error: candidatesError } = await supabase
      .from('recruitment_candidates')
      .select(`
        id,
        tenant_id,
        position_id,
        full_name,
        source,
        source_details,
        applied_at,
        current_stage,
        stage_updated_at,
        status,
        hired_at,
        hired_as_user_id,
        recruitment_cost,
        created_at
      `)
      .eq('tenant_id', tenantId)
      .gte('applied_at', startDateStr)
      .lte('applied_at', endDateStr);
    
    if (candidatesError || !candidatesData) {
      throw new QueryError(
        `Failed to query candidates: ${candidatesError?.message || 'No data returned'}`,
        candidatesError || undefined
      );
    }
    
    const candidates = candidatesData as RecruitmentCandidate[];
    
    // Query pipeline transitions for time-to-stage calculations
    const candidateIds: string[] = candidates.map(c => c.id);
    let pipelineTransitions: PipelineTransition[] = [];
    
    if (candidateIds.length > 0) {
      const { data: transitions, error: transitionsError } = await supabase
        .from('recruitment_pipelines')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('candidate_id', candidateIds);
      
      if (transitionsError) {
        console.warn('[RecruitmentMetrics] Failed to query pipeline transitions:', transitionsError.message);
      } else {
        pipelineTransitions = (transitions || []) as PipelineTransition[];
      }
    }
    
    // Query interviews for quality metrics
    let interviews: InterviewRecord[] = [];
    if (candidateIds.length > 0) {
      const { data: interviewData, error: interviewsError } = await supabase
        .from('recruitment_interviews')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('candidate_id', candidateIds)
        .eq('status', 'completed');
      
      if (interviewsError) {
        console.warn('[RecruitmentMetrics] Failed to query interviews:', interviewsError.message);
      } else {
        interviews = (interviewData || []) as InterviewRecord[];
      }
    }
    
    // Query hired users for 90-day retention (users who started within range and still active after 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ninetyDaysAgoStr = formatDate(ninetyDaysAgo);
    
    const hiredUserIds = candidates.filter(c => c.hired_as_user_id).map(c => c.hired_as_user_id!);
    let activeHiredUsers: UserRecord[] = [];
    
    if (hiredUserIds.length > 0) {
      const { data: userData, error: usersError } = await supabase
        .from('users')
        .select('id, created_at, status')
        .in('id', hiredUserIds)
        .gte('created_at', ninetyDaysAgoStr);
      
      if (usersError) {
        console.warn('[RecruitmentMetrics] Failed to query hired users:', usersError.message);
      } else {
        const typedUserData = (userData || []) as unknown as UserRecord[];
        activeHiredUsers = typedUserData.filter(u => u.status === 'active');
      }
    }
    
    // Calculate metrics
    const totalApplications = candidates.length;
    const applicationsHired = candidates.filter(c => c.status === 'hired').length;
    const applicationsRejected = candidates.filter(c => c.status === 'rejected').length;
    const applicationsActive = candidates.filter(c => c.status === 'active').length;
    
    // Stage-based counts
    const stageInterviewed = candidates.filter(c => 
      ['interview_1', 'interview_2', 'interview_final', 'offer', 'hired'].includes(c.current_stage)
    ).length;
    const stageOffered = candidates.filter(c => 
      ['offer', 'hired'].includes(c.current_stage)
    ).length;
    
    // Conversion rates
    const screenToInterviewPct = safePct(stageInterviewed, totalApplications);
    const interviewToOfferPct = safePct(stageOffered, stageInterviewed);
    const offerToHirePct = safePct(applicationsHired, stageOffered);
    const overallConversionPct = safePct(applicationsHired, totalApplications);
    
    // Time-to-hire calculations
    const hiredCandidates = candidates.filter(c => c.status === 'hired' && c.hired_at);
    const timeToHireDays = hiredCandidates.map(c => daysBetween(c.applied_at, c.hired_at));
    const avgTimeToHireDays = timeToHireDays.length > 0
      ? Math.round(timeToHireDays.reduce((sum, days) => sum + days, 0) / timeToHireDays.length)
      : 0;
    
    // Time-to-interview (from applied to first interview stage)
    const interviewedCandidates = pipelineTransitions.filter(t => 
      t.to_stage && ['interview_1', 'interview_2', 'interview_final'].includes(t.to_stage)
    );
    const candidateFirstInterviewMap = new Map<string, Date>();
    interviewedCandidates.forEach(t => {
      const candidateId = t.candidate_id;
      const transitionDate = new Date(t.transitioned_at);
      if (!candidateFirstInterviewMap.has(candidateId) || transitionDate < candidateFirstInterviewMap.get(candidateId)!) {
        candidateFirstInterviewMap.set(candidateId, transitionDate);
      }
    });
    
    const timeToInterviewDays: number[] = [];
    candidates.forEach(c => {
      const firstInterviewDate = candidateFirstInterviewMap.get(c.id);
      if (firstInterviewDate) {
        timeToInterviewDays.push(daysBetween(c.applied_at, firstInterviewDate));
      }
    });
    const avgTimeToInterviewDays = timeToInterviewDays.length > 0
      ? Math.round(timeToInterviewDays.reduce((sum, days) => sum + days, 0) / timeToInterviewDays.length)
      : 0;
    
    // Time-to-offer
    const offeredCandidates = pipelineTransitions.filter(t => t.to_stage === 'offer');
    const candidateOfferMap = new Map<string, Date>();
    offeredCandidates.forEach(t => {
      const transitionDate = new Date(t.transitioned_at);
      if (!candidateOfferMap.has(t.candidate_id) || transitionDate < candidateOfferMap.get(t.candidate_id)!) {
        candidateOfferMap.set(t.candidate_id, transitionDate);
      }
    });
    
    const timeToOfferDays: number[] = [];
    candidates.forEach(c => {
      const offerDate = candidateOfferMap.get(c.id);
      if (offerDate) {
        timeToOfferDays.push(daysBetween(c.applied_at, offerDate));
      }
    });
    const avgTimeToOfferDays = timeToOfferDays.length > 0
      ? Math.round(timeToOfferDays.reduce((sum, days) => sum + days, 0) / timeToOfferDays.length)
      : 0;
    
    // Cost metrics
    const totalRecruitmentCost = candidates.reduce((sum, c) => sum + (c.recruitment_cost || 0), 0);
    const costPerHire = applicationsHired > 0 ? Math.round(totalRecruitmentCost / applicationsHired) : 0;
    const costPerApplication = totalApplications > 0 ? Math.round(totalRecruitmentCost / totalApplications) : 0;
    
    // Source effectiveness
    const sourceMap = new Map<string, {
      applications: number;
      hires: number;
      totalCost: number;
    }>();
    
    candidates.forEach(c => {
      const source = c.source || 'unknown';
      if (!sourceMap.has(source)) {
        sourceMap.set(source, { applications: 0, hires: 0, totalCost: 0 });
      }
      const sourceData = sourceMap.get(source)!;
      sourceData.applications += 1;
      if (c.status === 'hired') sourceData.hires += 1;
      sourceData.totalCost += (c.recruitment_cost || 0);
    });
    
    const topSources = Array.from(sourceMap.entries())
      .map(([sourceName, data]) => ({
        sourceName,
        applications: data.applications,
        hires: data.hires,
        conversionRate: safePct(data.hires, data.applications),
        costPerHire: data.hires > 0 ? Math.round(data.totalCost / data.hires) : 0
      }))
      .sort((a, b) => b.hires - a.hires)
      .slice(0, 5); // Top 5 sources
    
    // Quality metrics
    const eligibleForRetentionCheck = hiredUserIds.filter(id => {
      const candidate = candidates.find(c => c.hired_as_user_id === id);
      if (!candidate || !candidate.hired_at) return false;
      const hireDate = new Date(candidate.hired_at);
      const ninetyDaysAfterHire = new Date(hireDate);
      ninetyDaysAfterHire.setDate(ninetyDaysAfterHire.getDate() + 90);
      return ninetyDaysAfterHire <= new Date(); // Only count if 90 days have passed
    });
    
    const retainedAfter90Days = activeHiredUsers.length;
    const newHireRetention90Days = eligibleForRetentionCheck.length > 0
      ? safePct(retainedAfter90Days, eligibleForRetentionCheck.length)
      : 0;
    
    // Average new hire rating (from first 90 days of interviews/performance)
    const hiredCandidateIds = hiredCandidates.map(c => c.id);
    const hiredInterviews = interviews.filter(i => hiredCandidateIds.includes(i.candidate_id));
    const interviewRatings = hiredInterviews
      .map(i => i.overall_rating)
      .filter((r): r is number => r !== null && r !== undefined);
    const avgNewHireRating = interviewRatings.length > 0
      ? Math.round((interviewRatings.reduce((sum, r) => sum + r, 0) / interviewRatings.length) * 10) / 10
      : 0;
    
    // Build result
    const metrics: RecruitmentMetrics = {
      tenantId,
      period: `${startDateStr}_to_${endDateStr}`,
      
      totalApplications,
      applicationsInReview: applicationsActive,
      applicationsInterviewed: stageInterviewed,
      applicationsOffered: stageOffered,
      applicationsHired,
      applicationsRejected,
      
      screenToInterviewPct,
      interviewToOfferPct,
      offerToHirePct,
      overallConversionPct,
      
      avgTimeToHireDays,
      avgTimeToInterviewDays,
      avgTimeToOfferDays,
      
      totalRecruitmentCost,
      costPerHire,
      costPerApplication,
      
      topSources,
      
      newHireRetention90Days,
      avgNewHireRating,
      
      periodStart: startDateStr,
      periodEnd: endDateStr,
      computedAt: new Date().toISOString()
    };
    
    return [metrics];
    
  } catch (error) {
    if (error instanceof QueryError) {
      throw error;
    }
    
    throw new QueryError(
      `Failed to calculate recruitment metrics: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }
}
