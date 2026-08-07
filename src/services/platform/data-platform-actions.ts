'use server';

/**
 * Enterprise Analytics Lakehouse (Host Data Platform) Actions
 * Phase C.2 – Host Data Platform
 *
 * Governance: Constitution #1 (Zero Silent DB Failures), #3 (Strict Types), #8 (Immutable Finalized)
 */

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface DataCatalogTable {
  id: string;
  tableName: string;
  domain: 'finance' | 'healthcare' | 'operations' | 'crm' | 'hr';
  description: string;
  columns: Array<{ name: string; type: string; description: string; isPrimary: boolean }>;
  rowCount: number;
  dataSizeMb: number;
}

export interface DataLineageNode {
  id: string;
  label: string;
  type: 'raw_table' | 'semantic_view' | 'report' | 'dashboard';
  dependencies: string[]; // IDs of parent nodes
}

export interface QueryHistoryRecord {
  id: string;
  querySql: string;
  executedBy: string;
  durationMs: number;
  rowsReturned: number;
  status: 'success' | 'failed';
  errorMessage: string | null;
  executedAt: string;
}

// ---------------------------------------------------------------------------
// Mock Analytical Data Catalog
// ---------------------------------------------------------------------------
const DATA_CATALOG: DataCatalogTable[] = [
  {
    id: 'tbl-finance-journals',
    tableName: 'analytics_finance_journals_fact',
    domain: 'finance',
    description: 'Bảng Fact hạch toán kế toán hợp nhất toàn hệ thống (Circular 133/200)',
    rowCount: 245089,
    dataSizeMb: 42.5,
    columns: [
      { name: 'journal_id', type: 'UUID', description: 'Mã bút toán', isPrimary: true },
      { name: 'tenant_id', type: 'UUID', description: 'Mã tenant', isPrimary: false },
      { name: 'account_debit', type: 'VARCHAR(10)', description: 'Tài khoản Nợ', isPrimary: false },
      { name: 'account_credit', type: 'VARCHAR(10)', description: 'Tài khoản Có', isPrimary: false },
      { name: 'amount', type: 'NUMERIC(15,2)', description: 'Số tiền giao dịch', isPrimary: false },
      { name: 'entry_date', type: 'DATE', description: 'Ngày ghi sổ', isPrimary: false },
    ],
  },
  {
    id: 'tbl-healthcare-encounters',
    tableName: 'analytics_healthcare_encounters_fact',
    domain: 'healthcare',
    description: 'Bảng Fact lượt khám bệnh, điều trị nội trú & ngoại trú HIS',
    rowCount: 12054,
    dataSizeMb: 8.3,
    columns: [
      { name: 'encounter_id', type: 'UUID', description: 'Mã lượt khám', isPrimary: true },
      { name: 'patient_id', type: 'UUID', description: 'Mã bệnh nhân', isPrimary: false },
      { name: 'admission_date', type: 'TIMESTAMP', description: 'Ngày giờ nhập viện', isPrimary: false },
      { name: 'discharge_date', type: 'TIMESTAMP', description: 'Ngày giờ xuất viện', isPrimary: false },
      { name: 'primary_icd10', type: 'VARCHAR(10)', description: 'Mã bệnh ICD-10 chính', isPrimary: false },
      { name: 'total_billing_amount', type: 'NUMERIC(12,2)', description: 'Tổng chi phí điều trị', isPrimary: false },
    ],
  },
  {
    id: 'tbl-spa-bookings',
    tableName: 'analytics_spa_bookings_fact',
    domain: 'operations',
    description: 'Bảng Fact lịch hẹn và trị liệu Beauty Spa/Babycare',
    rowCount: 894302,
    dataSizeMb: 124.1,
    columns: [
      { name: 'booking_id', type: 'UUID', description: 'Mã lịch hẹn', isPrimary: true },
      { name: 'customer_id', type: 'UUID', description: 'Mã khách hàng', isPrimary: false },
      { name: 'spa_branch_id', type: 'UUID', description: 'Mã chi nhánh', isPrimary: false },
      { name: 'start_time', type: 'TIMESTAMP', description: 'Thời gian bắt đầu', isPrimary: false },
      { name: 'status', type: 'VARCHAR(20)', description: 'Trạng thái lịch hẹn', isPrimary: false },
      { name: 'revenue', type: 'NUMERIC(12,2)', description: 'Doanh thu thu về', isPrimary: false },
    ],
  },
  {
    id: 'tbl-crm-leads',
    tableName: 'analytics_crm_leads_dim',
    domain: 'crm',
    description: 'Bảng Dim thông tin lead và lịch sử tương tác đa kênh',
    rowCount: 54109,
    dataSizeMb: 14.8,
    columns: [
      { name: 'lead_id', type: 'UUID', description: 'Mã lead', isPrimary: true },
      { name: 'source', type: 'VARCHAR(50)', description: 'Nguồn lead (Meta, Google, Call)', isPrimary: false },
      { name: 'qualification_score', type: 'INTEGER', description: 'Điểm tiềm năng (AI scored)', isPrimary: false },
      { name: 'assigned_agent_id', type: 'UUID', description: 'Telesale được phân bổ', isPrimary: false },
    ],
  },
];

// ---------------------------------------------------------------------------
// Mock Data Lineage
// ---------------------------------------------------------------------------
const DATA_LINEAGE: DataLineageNode[] = [
  { id: 'tbl-finance-journals', label: 'analytics_finance_journals_fact', type: 'raw_table', dependencies: [] },
  { id: 'tbl-healthcare-encounters', label: 'analytics_healthcare_encounters_fact', type: 'raw_table', dependencies: [] },
  { id: 'tbl-spa-bookings', label: 'analytics_spa_bookings_fact', type: 'raw_table', dependencies: [] },

  { id: 'view-unified-revenue', label: 'view_unified_revenue_by_industry', type: 'semantic_view', dependencies: ['tbl-finance-journals', 'tbl-healthcare-encounters', 'tbl-spa-bookings'] },
  { id: 'view-healthcare-pnl', label: 'view_healthcare_clinical_pnl', type: 'semantic_view', dependencies: ['tbl-finance-journals', 'tbl-healthcare-encounters'] },

  { id: 'report-finance-monthly', label: 'Report: Monthly Group Consolidation P&L', type: 'report', dependencies: ['view-unified-revenue'] },
  { id: 'report-hospital-efficiency', label: 'Report: Hospital Clinical Cost Efficiency', type: 'report', dependencies: ['view-healthcare-pnl'] },

  { id: 'dashboard-executive', label: 'Dashboard: Executive EIP Control Room', type: 'dashboard', dependencies: ['report-finance-monthly', 'report-hospital-efficiency'] },
];

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
export async function getDataCatalogAction(): Promise<{
  data: DataCatalogTable[];
  error: string | null;
}> {
  return { data: DATA_CATALOG, error: null };
}

export async function getDataLineageAction(): Promise<{
  data: DataLineageNode[];
  error: string | null;
}> {
  return { data: DATA_LINEAGE, error: null };
}

export async function executeLakehouseQueryAction(querySql: string): Promise<{
  success: boolean;
  durationMs: number;
  rowCount: number;
  columns: string[];
  rows: Record<string, string | number | boolean | null>[];
  error: string | null;
}> {
  const startTime = Date.now();
  const cleanedQuery = querySql.trim().toLowerCase();

  // Simple query parsing for demonstration
  let matchedTable: DataCatalogTable | undefined;
  if (cleanedQuery.includes('analytics_finance_journals_fact')) {
    matchedTable = DATA_CATALOG.find((t) => t.tableName === 'analytics_finance_journals_fact');
  } else if (cleanedQuery.includes('analytics_healthcare_encounters_fact')) {
    matchedTable = DATA_CATALOG.find((t) => t.tableName === 'analytics_healthcare_encounters_fact');
  } else if (cleanedQuery.includes('analytics_spa_bookings_fact')) {
    matchedTable = DATA_CATALOG.find((t) => t.tableName === 'analytics_spa_bookings_fact');
  } else if (cleanedQuery.includes('analytics_crm_leads_dim')) {
    matchedTable = DATA_CATALOG.find((t) => t.tableName === 'analytics_crm_leads_dim');
  }

  const durationMs = Math.floor(Math.random() * 80) + 12; // Clickhouse speed simulation

  if (!matchedTable) {
    return {
      success: false,
      durationMs,
      rowCount: 0,
      columns: [],
      rows: [],
      error: `Table not found or syntax error: Only SELECT * FROM analytics_[table] is permitted.`,
    };
  }

  // Generate simulated query rows matching table schema
  const rows: Record<string, string | number | boolean | null>[] = [];
  const count = 5;

  for (let i = 0; i < count; i++) {
    const row: Record<string, string | number | boolean | null> = {};
    matchedTable.columns.forEach((col) => {
      if (col.type === 'UUID') {
        row[col.name] = `db0a95ff-4841-4702-861f-135e69df000${i}`;
      } else if (col.type.startsWith('VARCHAR')) {
        if (col.name === 'account_debit' || col.name === 'account_credit') {
          row[col.name] = i % 2 === 0 ? '1111' : '5113';
        } else if (col.name === 'primary_icd10') {
          row[col.name] = ['A09', 'E11', 'I10', 'J06'][i % 4];
        } else if (col.name === 'status') {
          row[col.name] = ['completed', 'pending', 'cancelled'][i % 3];
        } else {
          row[col.name] = `value_${i}`;
        }
      } else if (col.type.startsWith('NUMERIC')) {
        row[col.name] = Math.floor(Math.random() * 800000) + 150000;
      } else if (col.type === 'TIMESTAMP' || col.type === 'DATE') {
        row[col.name] = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().split('T')[0];
      } else if (col.type === 'INTEGER') {
        row[col.name] = Math.floor(Math.random() * 100);
      } else {
        row[col.name] = null;
      }
    });
    rows.push(row);
  }

  const columns = matchedTable.columns.map((c) => c.name);

  // Record this execution query in local audit or just return it
  return {
    success: true,
    durationMs,
    rowCount: matchedTable.rowCount,
    columns,
    rows,
    error: null,
  };
}
