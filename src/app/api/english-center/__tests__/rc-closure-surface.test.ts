import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

const mockGetUser = jest.fn();
const mockRecordLearningProgress = jest.fn();
const mockCreateTuitionPlan = jest.fn();
const mockCreateTemplate = jest.fn();
const mockGetDashboard = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

jest.mock('@/platform/education/contracts/assessment.contract.impl', () => ({
  AssessmentContractImpl: jest.fn(),
}));

jest.mock('@/platform/education/contracts/student.contract.impl', () => ({
  StudentContractImpl: jest.fn(),
}));

jest.mock('@/platform/party', () => ({
  partyEngine: {
    findById: jest.fn(),
  },
}));

jest.mock('@/platform/org-unit', () => ({
  orgUnitEngine: {
    getHierarchy: jest.fn(),
    getOrgUnits: jest.fn(),
  },
}));

jest.mock('@/products/bella-english-center/repositories/command-center.repository', () => ({
  ChainCommandCenterRepository: jest.fn(),
}));

jest.mock('@/products/bella-english-center/services/learning-operations.service', () => ({
  LearningOperationsService: jest.fn().mockImplementation(() => ({
    recordLearningProgress: mockRecordLearningProgress,
  })),
}));

jest.mock('@/products/bella-english-center/services/tuition-billing.service', () => ({
  TuitionBillingService: jest.fn().mockImplementation(() => ({
    createTuitionPlan: mockCreateTuitionPlan,
  })),
}));

jest.mock('@/products/bella-english-center/services/engagement.service', () => ({
  EngagementService: jest.fn().mockImplementation(() => ({
    createTemplate: mockCreateTemplate,
  })),
}));

jest.mock('@/products/bella-english-center/services/command-center.service', () => ({
  ChainCommandCenterService: jest.fn().mockImplementation(() => ({
    getDashboard: mockGetDashboard,
  })),
}));

const { POST: postProgress } = require('../learning/progress/route') as typeof import('../learning/progress/route');
const { POST: postTuitionPlan } = require('../tuition/plans/route') as typeof import('../tuition/plans/route');
const { POST: postEngagementTemplate } = require('../engagement/templates/route') as typeof import('../engagement/templates/route');
const { GET: getCommandCenter } = require('../command-center/route') as typeof import('../command-center/route');

function postRequest(url: string, body: object): NextRequest {
  return new Request(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as NextRequest;
}

function getRequest(url: string): NextRequest {
  return new Request(url, { method: 'GET' }) as NextRequest;
}

describe('English Center RC closure API surfaces', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          user_metadata: { tenant_id: 'tenant-1' },
        },
      },
      error: null,
    });
  });

  it('dispatches E6 learning progress through the authenticated tenant context', async () => {
    mockRecordLearningProgress.mockResolvedValue({ id: 'progress-1' });

    const response = await postProgress(postRequest('http://localhost/api/english-center/learning/progress', {
      englishEnrollmentId: 'enrollment-1',
      progressLabel: 'on_track',
      skillArea: 'overall',
    }));

    expect(response.status).toBe(201);
    expect(mockRecordLearningProgress).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        englishEnrollmentId: 'enrollment-1',
        progressLabel: 'on_track',
        recordedBy: 'user-1',
      })
    );
  });

  it('dispatches E7 tuition plan creation through the authenticated tenant context', async () => {
    mockCreateTuitionPlan.mockResolvedValue({ id: 'plan-1' });

    const response = await postTuitionPlan(postRequest('http://localhost/api/english-center/tuition/plans', {
      code: 'MONTHLY-A1',
      name: 'Monthly A1',
      billingCycle: 'monthly',
      amountMinor: '150000000',
    }));

    expect(response.status).toBe(201);
    expect(mockCreateTuitionPlan).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        code: 'MONTHLY-A1',
        currency: 'VND',
      })
    );
  });

  it('dispatches E8 engagement template creation through the authenticated tenant context', async () => {
    mockCreateTemplate.mockResolvedValue({ id: 'template-1' });

    const response = await postEngagementTemplate(postRequest('http://localhost/api/english-center/engagement/templates', {
      code: 'GENERAL-NOTE',
      name: 'General Note',
      category: 'general',
      titleTemplate: 'Class update',
      bodyTemplate: 'Today update',
      defaultChannels: ['in_app'],
    }));

    expect(response.status).toBe(201);
    expect(mockCreateTemplate).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        code: 'GENERAL-NOTE',
        defaultChannels: ['in_app'],
      })
    );
  });

  it('dispatches E9 command center dashboard through the authenticated tenant context', async () => {
    mockGetDashboard.mockResolvedValue({
      tenantId: 'tenant-1',
      asOf: '2026-09-14T00:00:00.000Z',
      totals: { branchCount: 0 },
      branches: [],
      workQueue: [],
    });

    const response = await getCommandCenter(
      getRequest('http://localhost/api/english-center/command-center?branchIds=branch-1,branch-2')
    );

    expect(response.status).toBe(200);
    expect(mockGetDashboard).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        branchIds: ['branch-1', 'branch-2'],
      })
    );
  });
});
