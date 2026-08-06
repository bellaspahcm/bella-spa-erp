import { ToothData } from '../components/OdontogramTwin';

export type EncounterStatus = 'planned' | 'arrived' | 'triaged' | 'in_progress' | 'finished' | 'cancelled';

export interface PatientInfo {
  readonly id: string;
  readonly recordNumber: string; // e.g. BN000124
  readonly name: string;
  readonly gender: 'male' | 'female' | 'other';
  readonly dob: string;
  readonly age: number;
  readonly bloodType?: string;
  readonly allergies: string[];
  readonly toothData: Record<string, ToothData>;
  readonly phone?: string;
}

export interface DoctorInfo {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly avatarUrl?: string;
}

export interface ChairInfo {
  readonly id: string;
  readonly code: string; // e.g. Chair 03
  readonly zone: string; // e.g. Khu A - Ghế chính
  readonly status: 'occupied' | 'available' | 'sanitizing' | 'maintenance';
  readonly currentPatientName?: string;
  readonly currentDoctorName?: string;
  readonly estimatedMinutesRemaining?: number;
}

export interface TimelineStep {
  readonly id: string;
  readonly time: string; // e.g. 09:28
  readonly title: string;
  readonly actor: string;
  readonly status: 'completed' | 'current' | 'pending';
  readonly durationMinutes?: number;
  readonly isBottleneck?: boolean;
}

export interface DomainEventStreamItem {
  readonly id: string;
  readonly eventName: string;
  readonly timestamp: string;
  readonly description: string;
  readonly actor: string;
  readonly category: 'encounter' | 'clinical' | 'prescription' | 'resource' | 'billing';
}

export interface CarePathStep {
  readonly stepNumber: number;
  readonly title: string;
  readonly subtitle: string;
  readonly status: 'completed' | 'in_progress' | 'pending';
  readonly date?: string;
  readonly notes?: string;
}

export interface AiRecommendation {
  readonly id: string;
  readonly toothNumber?: string;
  readonly diagnosis: string;
  readonly severity: 'critical' | 'moderate' | 'routine';
  readonly suggestedProtocol: Array<{
    stepNumber: number;
    actionName: string;
    estimatedCost?: string;
  }>;
  readonly recallMonths: number;
  readonly rationale: string;
}

export interface AiCooAction {
  readonly id: string;
  readonly priority: 'high' | 'medium' | 'info';
  readonly category: 'chair' | 'patient_wait' | 'pharmacy' | 'capacity';
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly actionType: 'assign_chair' | 'alert_doctor' | 'verify_prescription' | 'reroute_queue';
}

export interface ResourceUtilization {
  readonly chairOccupancyRate: number; // e.g. 82%
  readonly doctorOccupancyRate: number; // e.g. 91%
  readonly avgWaitTimeMinutes: number; // e.g. 12m
  readonly totalEncountersToday: number;
}

export interface EncounterAggregate {
  readonly encounterId: string;
  readonly aggregateCode: string; // e.g. #EC202600124
  readonly status: EncounterStatus;
  readonly patient: PatientInfo;
  readonly doctor: DoctorInfo;
  readonly chair: ChairInfo;
  readonly chiefComplaint: string;
  readonly timeline: TimelineStep[];
  readonly carePath: CarePathStep[];
  readonly aiRecommendations: AiRecommendation[];
}
