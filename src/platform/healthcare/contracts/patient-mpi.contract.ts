/**
 * Patient/MPI Public Contract
 *
 * Minimal Product-facing Healthcare contract for patient identity resolution.
 * This contract exposes only the Foundation operations proven necessary for
 * Hospital to proceed later: register, get, identifier lookup, and search.
 *
 * It does not implement EMR, merge/deduplication, encounter, admission,
 * clinical, billing, or finance behavior.
 *
 * @module platform/healthcare/contracts/patient-mpi
 */

import type { ContractMetadata } from '../../host/contract-registry/types';
import type { EngineResponse } from '../shared-kernel/types';

export type PatientMpiIdentifierType = 'bhyt' | 'cccd';

export type PatientMpiGender = 'male' | 'female' | 'other';

export interface PatientMpiIdentifierDTO {
  type: PatientMpiIdentifierType;
  value: string;
  issuedAt?: string;
  expiresAt?: string;
}

export interface PatientMpiDTO {
  tenantId: string;
  patientId: string;
  displayName: string;
  legalName?: string;
  dob?: string;
  gender?: PatientMpiGender;
  bloodType?: string;
  identifiers: PatientMpiIdentifierDTO[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RegisterPatientRequest {
  tenantId: string;
  displayName: string;
  legalName?: string;
  dob?: string;
  gender?: PatientMpiGender;
  bloodType?: string;
  bhytNumber?: string;
  nationalId?: string;
  actorId: string;
}

export interface GetPatientByIdRequest {
  tenantId: string;
  patientId: string;
}

export interface FindPatientByIdentifierRequest {
  tenantId: string;
  identifierType: PatientMpiIdentifierType;
  identifierValue: string;
}

export interface SearchPatientsRequest {
  tenantId: string;
  displayNameLike?: string;
  identifierType?: PatientMpiIdentifierType;
  identifierValue?: string;
  limit?: number;
  offset?: number;
}

export interface PatientMpiContract {
  readonly engineName: 'patient-mpi';
  readonly engineVersion: string;
  readonly contractVersion: string;

  registerPatient(request: RegisterPatientRequest): Promise<EngineResponse<PatientMpiDTO>>;
  getPatientById(request: GetPatientByIdRequest): Promise<EngineResponse<PatientMpiDTO>>;
  findPatientByIdentifier(request: FindPatientByIdentifierRequest): Promise<EngineResponse<PatientMpiDTO | null>>;
  searchPatients(request: SearchPatientsRequest): Promise<EngineResponse<PatientMpiDTO[]>>;
}

export const PATIENT_MPI_CONTRACT: ContractMetadata = {
  name: 'patient-mpi',
  version: '1.0.0',
  type: 'engine',
  description: 'Minimal Healthcare Patient/MPI identity contract for Product consumption',
  owner: 'Healthcare Platform Team',
  status: 'active',
  endpoints: [
    {
      path: '/api/patient-mpi/register',
      method: 'POST',
      operationId: 'registerPatient',
      summary: 'Register a patient identity in the Healthcare Patient/MPI boundary',
      requestSchema: {
        schemaId: 'patient-mpi-register-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['tenantId', 'displayName', 'actorId'],
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            displayName: { type: 'string', minLength: 1 },
            legalName: { type: 'string' },
            dob: { type: 'string', format: 'date' },
            gender: { type: 'string', enum: ['male', 'female', 'other'] },
            bloodType: { type: 'string' },
            bhytNumber: { type: 'string' },
            nationalId: { type: 'string' },
            actorId: { type: 'string', format: 'uuid' },
          },
        },
      },
      responseSchema: {
        schemaId: 'patient-mpi-identity',
        version: '1.0.0',
        inline: false,
      },
      authentication: [{ type: 'bearer', roles: ['receptionist', 'nurse', 'doctor', 'admin'] }],
    },
    {
      path: '/api/patient-mpi/get',
      method: 'POST',
      operationId: 'getPatientById',
      summary: 'Get patient identity by tenant and patient ID',
      requestSchema: {
        schemaId: 'patient-mpi-get-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['tenantId', 'patientId'],
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            patientId: { type: 'string', format: 'uuid' },
          },
        },
      },
      responseSchema: {
        schemaId: 'patient-mpi-identity',
        version: '1.0.0',
        inline: false,
      },
      authentication: [{ type: 'bearer', roles: ['receptionist', 'nurse', 'doctor', 'admin'] }],
    },
    {
      path: '/api/patient-mpi/find-by-identifier',
      method: 'POST',
      operationId: 'findPatientByIdentifier',
      summary: 'Find patient identity by BHYT or CCCD identifier',
      requestSchema: {
        schemaId: 'patient-mpi-find-by-identifier-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['tenantId', 'identifierType', 'identifierValue'],
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            identifierType: { type: 'string', enum: ['bhyt', 'cccd'] },
            identifierValue: { type: 'string', minLength: 1 },
          },
        },
      },
      responseSchema: {
        schemaId: 'patient-mpi-identity',
        version: '1.0.0',
        inline: false,
      },
      authentication: [{ type: 'bearer', roles: ['receptionist', 'nurse', 'doctor', 'admin'] }],
    },
    {
      path: '/api/patient-mpi/search',
      method: 'POST',
      operationId: 'searchPatients',
      summary: 'Search patient identities within one tenant',
      requestSchema: {
        schemaId: 'patient-mpi-search-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['tenantId'],
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            displayNameLike: { type: 'string' },
            identifierType: { type: 'string', enum: ['bhyt', 'cccd'] },
            identifierValue: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
            offset: { type: 'integer', minimum: 0 },
          },
        },
      },
      responseSchema: {
        schemaId: 'patient-mpi-search-response',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['patients'],
          properties: {
            patients: {
              type: 'array',
              items: { type: 'object' },
            },
          },
        },
      },
      authentication: [{ type: 'bearer', roles: ['receptionist', 'nurse', 'doctor', 'admin'] }],
    },
  ],
  events: [
    {
      eventType: 'PatientRegistered',
      version: '1.0.0',
      summary: 'Published when a patient identity is registered',
      payloadSchema: {
        schemaId: 'patient-registered-payload',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['tenantId', 'patientId', 'displayName'],
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            patientId: { type: 'string', format: 'uuid' },
            displayName: { type: 'string' },
            identifiers: {
              type: 'array',
              items: { type: 'object' },
            },
          },
        },
      },
      publisher: 'patient-mpi',
      subscribers: ['encounter-engine', 'admission-engine'],
    },
  ],
  registeredAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
