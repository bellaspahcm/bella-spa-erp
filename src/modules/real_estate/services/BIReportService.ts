import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

// ─── Sales Dashboard KPIs ────────────────────────────────────────────────────

export interface SalesDashboardKPI {
  tenantId: string;
  period: string; // YYYY-MM
  totalRevenue: number;
  totalBookings: number;
  totalDeposits: number;
  totalContracts: number;
  totalCancelations: number;
  netConversionRate: number;
  avgDealSizeVnd: number;
  topProjectId: string | null;
  topProjectName: string | null;
  topProjectRevenue: number;
}

export interface SalesFunnelKPI {
  leads: number;
  qualified: number;
  siteVisits: number;
  opportunities: number;
  bookings: number;
  deposits: number;
  contracts: number;
  conversionLeadToContract: number;
}

export interface MonthlyTrendPoint {
  month: string;
  revenue: number;
  contracts: number;
  newLeads: number;
}

export interface ProjectInventorySnapshot {
  projectId: string;
  projectName: string;
  total: number;
  available: number;
  booked: number;
  deposited: number;
  signed: number;
  handover: number;
  totalValueVnd: number;
  soldValueVnd: number;
  occupancyRatePct: number;
}

export interface BIReportSnapshot {
  generatedAt: string;
  periodMonth: string;
  kpis: SalesDashboardKPI;
  funnel: SalesFunnelKPI;
  trends: MonthlyTrendPoint[];
  projectSnapshots: ProjectInventorySnapshot[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class BIReportService {
  /**
   * Builds a full BI snapshot from production tables.
   * Note: Lead funnel data is placeholder until rm_leads view is migrated.
   */
  static async buildSnapshot(
    supabase: SupabaseClient<Database>,
    tenantId: string,
    periodMonth?: string
  ): Promise<BIReportSnapshot> {
    const now = new Date();
    const period = periodMonth ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // ── 1. Projects ────────────────────────────────────────────────────────────
    const { data: projects } = await supabase
      .from('real_estate_projects')
      .select('id, name, status')
      .eq('tenant_id', tenantId);

    // ── 2. Products ────────────────────────────────────────────────────────────
    const { data: products } = await supabase
      .from('real_estate_products')
      .select('id, project_id, status, unit_price')
      .eq('tenant_id', tenantId);

    const projList = projects ?? [];
    const prodList = products ?? [];

    // Build project inventory snapshots
    const projectSnapshots: ProjectInventorySnapshot[] = projList.map(proj => {
      const pp = prodList.filter(p => p.project_id === proj.id);
      const available = pp.filter(p => p.status === 'available').length;
      const booked = pp.filter(p => p.status === 'booked').length;
      const deposited = pp.filter(p => p.status === 'deposited').length;
      const signed = pp.filter(p => p.status === 'contracted').length;
      const handover = pp.filter(p => p.status === 'handed_over').length;
      const totalValueVnd = pp.reduce((s, p) => s + Number(p.unit_price || 0), 0);
      const soldValueVnd = pp
        .filter(p => ['deposited', 'contracted', 'handed_over'].includes(p.status))
        .reduce((s, p) => s + Number(p.unit_price || 0), 0);
      const total = pp.length;
      return {
        projectId: proj.id,
        projectName: proj.name,
        total,
        available,
        booked,
        deposited,
        signed,
        handover,
        totalValueVnd,
        soldValueVnd,
        occupancyRatePct: total > 0 ? Math.round(((total - available) / total) * 100) : 0,
      };
    });

    // Top project by sold value
    const topProject = [...projectSnapshots].sort((a, b) => b.soldValueVnd - a.soldValueVnd)[0] ?? null;

    // ── 3. Derive sales KPIs from product statuses ─────────────────────────────
    const totalBookings = prodList.filter(p => p.status === 'booked').length;
    const totalDeposits = prodList.filter(p => p.status === 'deposited').length;
    const totalContracts = prodList.filter(p => ['contract_signed', 'handover'].includes(p.status)).length;
    const totalCancelations = prodList.filter(p => p.status === 'cancelled').length;
    const totalRevenue = prodList
      .filter(p => ['contract_signed', 'handover'].includes(p.status))
      .reduce((s, p) => s + Number(p.unit_price || 0), 0);

    // Lead funnel: placeholder zeros until rm_leads view migration
    const leadsN = 0;
    const netConversionRate = 0;
    const avgDealSizeVnd = totalContracts > 0 ? totalRevenue / totalContracts : 0;

    // ── 4. 6-month trend (product-based) ─────────────────────────────────────
    const trends: MonthlyTrendPoint[] = [];
    for (let m = 5; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      trends.push({ month: monthStr, revenue: 0, contracts: 0, newLeads: 0 });
    }

    const kpis: SalesDashboardKPI = {
      tenantId,
      period,
      totalRevenue,
      totalBookings,
      totalDeposits,
      totalContracts,
      totalCancelations,
      netConversionRate,
      avgDealSizeVnd,
      topProjectId: topProject?.projectId ?? null,
      topProjectName: topProject?.projectName ?? null,
      topProjectRevenue: topProject?.soldValueVnd ?? 0,
    };

    const funnel: SalesFunnelKPI = {
      leads: leadsN,
      qualified: 0,
      siteVisits: 0,
      opportunities: 0,
      bookings: totalBookings,
      deposits: totalDeposits,
      contracts: totalContracts,
      conversionLeadToContract: netConversionRate,
    };

    return {
      generatedAt: now.toISOString(),
      periodMonth: period,
      kpis,
      funnel,
      trends,
      projectSnapshots,
    };
  }
}
