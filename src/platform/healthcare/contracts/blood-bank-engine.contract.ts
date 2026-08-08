/**
 * Blood Bank Engine Contract
 * Healthcare Platform - Platform-of-Platforms
 */

import { Database } from '@/types/supabase';
import { EngineResponse } from '../shared-kernel/types';

export type BloodUnitRow = Database['public']['Tables']['hc_blood_units']['Row'];
export type BloodCrossmatchRow = Database['public']['Tables']['hc_blood_crossmatch_records']['Row'];
export type TransfusionVerificationRow = Database['public']['Tables']['hc_transfusion_verifications']['Row'];
export type TransfusionRecordRow = Database['public']['Tables']['hc_transfusion_records']['Row'];

export interface ReceiveBloodUnitRequest {
  requestId: string;
  tenantId: string;
  unitNumber: string;
  bloodType: 'A' | 'B' | 'AB' | 'O';
  rhFactor: 'POSITIVE' | 'NEGATIVE';
  componentType: 'RBC';
  expiryDate: string;
}

export interface RequestBloodCrossmatchRequest {
  requestId: string;
  tenantId: string;
  encounterId: string;
  bloodUnitId: string;
}

export interface RecordCrossmatchResultRequest {
  requestId: string;
  tenantId: string;
  crossmatchId: string;
  status: 'COMPATIBLE' | 'INCOMPATIBLE';
  crossmatchedBy: string;
}

export interface ApproveCrossmatchRequest {
  requestId: string;
  tenantId: string;
  crossmatchId: string;
  approvedBy: string;
}

export interface ReserveBloodUnitRequest {
  requestId: string;
  tenantId: string;
  encounterId: string;
  bloodUnitId: string;
}

export interface DoubleVerifyTransfusionRequest {
  requestId: string;
  tenantId: string;
  encounterId: string;
  bloodUnitId: string;
  crossmatchId: string;
  verificationData: {
    patientId: string;
    unitNumber: string;
    bloodType: 'A' | 'B' | 'AB' | 'O';
    rhFactor: 'POSITIVE' | 'NEGATIVE';
    component: 'RBC';
    crossmatchResult: 'COMPATIBLE' | 'INCOMPATIBLE';
  };
  verifiedByClinicianA: string;
  verifiedByClinicianB: string;
}

export interface StartTransfusionRequest {
  requestId: string;
  tenantId: string;
  encounterId: string;
  bloodUnitId: string;
  verificationId: string;
  startedAt: string;
}

export interface CompleteTransfusionRequest {
  requestId: string;
  tenantId: string;
  transfusionId: string;
  completedAt: string;
  reactionOccurred: boolean;
  reactionDetails?: string;
}

export interface BloodBankEngineContract {
  receiveBloodUnit(request: ReceiveBloodUnitRequest): Promise<EngineResponse<BloodUnitRow>>;
  requestCrossmatch(request: RequestBloodCrossmatchRequest): Promise<EngineResponse<BloodCrossmatchRow>>;
  recordCrossmatchResult(request: RecordCrossmatchResultRequest): Promise<EngineResponse<BloodCrossmatchRow>>;
  approveCrossmatch(request: ApproveCrossmatchRequest): Promise<EngineResponse<BloodCrossmatchRow>>;
  reserveBloodUnit(request: ReserveBloodUnitRequest): Promise<EngineResponse<BloodUnitRow>>;
  doubleVerifyTransfusion(request: DoubleVerifyTransfusionRequest): Promise<EngineResponse<TransfusionVerificationRow>>;
  startTransfusion(request: StartTransfusionRequest): Promise<EngineResponse<TransfusionRecordRow>>;
  completeTransfusion(request: CompleteTransfusionRequest): Promise<EngineResponse<TransfusionRecordRow>>;
}
