import { NextRequest, NextResponse } from 'next/server';
import { ChainCommandCenterRepository } from '@/products/bella-english-center/repositories/command-center.repository';
import { ChainCommandCenterService } from '@/products/bella-english-center/services/command-center.service';
import {
  ChainCommandCenterInput,
  CommandCenterRiskThresholds,
} from '@/products/bella-english-center/types/command-center.types';
import { apiError, getEnglishCenterApiContext } from '../_shared';

function parseNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseThresholds(searchParams: URLSearchParams): Partial<CommandCenterRiskThresholds> | undefined {
  const thresholds: Partial<CommandCenterRiskThresholds> = {
    attendanceRateWarning: parseNumber(searchParams.get('attendanceRateWarning')),
    attendanceRateCritical: parseNumber(searchParams.get('attendanceRateCritical')),
    teacherLoadWarningSessions: parseNumber(searchParams.get('teacherLoadWarningSessions')),
    overdueInvoiceWarning: parseNumber(searchParams.get('overdueInvoiceWarning')),
  };

  const hasThreshold = Object.values(thresholds).some((value) => value !== undefined);
  return hasThreshold ? thresholds : undefined;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getEnglishCenterApiContext();
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const branchIds = searchParams.get('branchIds')
      ?.split(',')
      .map((branchId) => branchId.trim())
      .filter(Boolean);
    const input: ChainCommandCenterInput = {
      rootOrgUnitId: searchParams.get('rootOrgUnitId') || null,
      branchIds,
      asOf: searchParams.get('asOf') || undefined,
      thresholds: parseThresholds(searchParams),
    };

    const repository = new ChainCommandCenterRepository(auth.context.supabase);
    const { orgUnitEngine } = await import('@/platform/org-unit');
    const service = new ChainCommandCenterService(repository, { orgUnits: orgUnitEngine });
    const dashboard = await service.getDashboard(auth.context.tenantId, input);

    return NextResponse.json(dashboard, { status: 200 });
  } catch (error: unknown) {
    return apiError(error, 'GET /api/english-center/command-center error:');
  }
}
