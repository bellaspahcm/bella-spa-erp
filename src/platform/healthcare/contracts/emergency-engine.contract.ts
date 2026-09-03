/**
 * Emergency Department Engine Contract
 * Healthcare Platform - Platform-of-Platforms
 */

import { Database } from '@/types/database.types';
import { EngineResponse } from '../shared-kernel/types';

export type EmergencyVisitRow = Database['public']['Tables']['hc_emergency_visits']['Row'];
export type TriageAssessmentRow = Database['public']['Tables']['hc_triage_assessments']['Row'];

export interface RegisterEmergencyVisitRequest {
  requestId: string;
  tenantId: string;
  encounterId: string;
  chiefComplaint: string;
}

export interface PerformTriageRequest {
  requestId: string;
  tenantId: string;
  emergencyVisitId: string;
  acuityLevel: number; // ESI v5 level: 1 to 5
  assessmentType: 'initial' | 'reassessment' | 'retriage';
  acuityCriteria: {
    immediateLifeSavingInterventionRequired: boolean;
    highRiskSituation: boolean;
    confusedLethargicDisoriented: boolean;
    severePainDistress: boolean;
    predictedResourcesNeeded: number; // 0, 1, or 2+ (many)
    vitalSignModifiers: {
      dangerZoneHeartRate?: boolean;
      dangerZoneRespiratoryRate?: boolean;
      dangerZoneSpo2?: boolean;
    };
  };
  assessedBy: string;
}

export interface CalculateNedocsRequest {
  tenantId: string;
  encounterId: string;
  emergencyVisitId: string;
  totalEdBeds: number;
  activeEdPatients: number;
  criticalPatients: number;
  admittedPatientsWaitingForBeds: number;
  ventilatorsInUse: number;
  longestWaitTimeHrs: number;
}

export interface CalculateNedocsResponse {
  score: number;
  calculationId: string;
}

export interface AssignEmergencyBedRequest {
  requestId: string;
  tenantId: string;
  emergencyVisitId: string;
  bedId: string;
}

export interface EmergencyEngineContract {
  registerEmergencyVisit(request: RegisterEmergencyVisitRequest): Promise<EngineResponse<EmergencyVisitRow>>;
  performTriage(request: PerformTriageRequest): Promise<EngineResponse<TriageAssessmentRow>>;
  assignEmergencyBed(request: AssignEmergencyBedRequest): Promise<EngineResponse<EmergencyVisitRow>>;
  calculateNedocsScore(request: CalculateNedocsRequest): Promise<EngineResponse<CalculateNedocsResponse>>;
}
