import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase-server";
import {
  exportAccountingReportToExcel,
  exportSalaryToExcel,
  exportSessionMatrixToExcel,
  type AccountingReportRecord,
  type TrialBalanceExportRow,
} from "@/services/export-actions";

jest.mock("@/lib/supabase-server", () => ({
  createClient: jest.fn(),
}));

type SheetRow = unknown[];

const mockCreateClient = createClient as jest.Mock;

function workbookFromBase64(base64: string): XLSX.WorkBook {
  return XLSX.read(Buffer.from(base64, "base64"), { type: "buffer" });
}

function rowsFromSheet(workbook: XLSX.WorkBook, sheetName: string): SheetRow[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Missing sheet ${sheetName}`);
  return XLSX.utils.sheet_to_json<SheetRow>(sheet, {
    header: 1,
    raw: true,
    blankrows: false,
  });
}

function mockSessionQuery(
  result: { data: unknown[] | null; error: Error | null },
) {
  let eqCalls = 0;
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => {
      eqCalls += 1;
      return eqCalls >= 2 ? Promise.resolve(result) : query;
    }),
  };
  return query;
}

function mockSalaryQuery(data: Record<string, unknown> | null) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    single: jest.fn().mockResolvedValue({ data, error: null }),
  };
  return query;
}

describe("exportSessionMatrixToExcel", () => {
  it("writes package columns and computes per-KTV totals", async () => {
    const base64 = await exportSessionMatrixToExcel(
      [
        { name: "KTV A", "Basic Care": 2, "VIP Care": 1.5 },
        { name: "KTV B", "Basic Care": 0, "VIP Care": 3 },
      ],
      ["Basic Care", "VIP Care"],
    );

    const workbook = workbookFromBase64(base64);
    expect(workbook.SheetNames).toContain("Doi Soat Buoi Lam");

    const rows = rowsFromSheet(workbook, "Doi Soat Buoi Lam");
    expect(rows.find((row) => row[1] === "Basic Care")).toEqual([
      "Kỹ thuật viên",
      "Basic Care",
      "VIP Care",
      "Tổng cộng",
    ]);
    expect(rows.find((row) => row[0] === "KTV A")).toEqual(["KTV A", 2, 1.5, 3.5]);
    expect(rows.find((row) => row[0] === "KTV B")).toEqual(["KTV B", 0, 3, 3]);
  });
});

describe("exportAccountingReportToExcel", () => {
  it("writes a TT133 trial balance with summed debit/credit totals", async () => {
    const rows: TrialBalanceExportRow[] = [
      {
        account_code: "111",
        account_name: "Cash",
        opening_debit: 1_000,
        opening_credit: 0,
        period_debit: 5_000,
        period_credit: 2_000,
        closing_debit: 4_000,
        closing_credit: 0,
      },
      {
        account_code: "511",
        account_name: "Revenue",
        opening_debit: 0,
        opening_credit: 500,
        period_debit: 0,
        period_credit: 3_000,
        closing_debit: 0,
        closing_credit: 3_500,
      },
    ];

    const workbook = workbookFromBase64(
      await exportAccountingReportToExcel("trial_balance", rows, "2026-05-31"),
    );

    expect(workbook.SheetNames).toContain("Trial Balance");
    const sheetRows = rowsFromSheet(workbook, "Trial Balance");
    expect(sheetRows.at(-1)).toEqual([
      "TỔNG CỘNG",
      "",
      1_000,
      500,
      5_000,
      5_000,
      4_000,
      3_500,
    ]);
    expect(workbook.Sheets["Trial Balance"]["!merges"]).toHaveLength(3);
  });

  it("maps income statement line items into TT133 report codes", async () => {
    const pnl: AccountingReportRecord = {
      gross_revenue: 10_000,
      deductions: 1_000,
      net_revenue: 9_000,
      cost_of_goods_sold: 2_000,
      gross_profit: 7_000,
      operating_expense: 3_000,
      operating_profit: 4_000,
      other_income: 300,
      other_expense: 50,
      profit_before_tax: 4_250,
      tax_expense: 250,
      net_profit: 4_000,
    };

    const workbook = workbookFromBase64(
      await exportAccountingReportToExcel("income_statement", pnl, "2026-05"),
    );
    const rows = rowsFromSheet(workbook, "Profit and Loss");

    expect(rows.find((row) => row[1] === "01")?.[3]).toBe(10_000);
    expect(rows.find((row) => row[1] === "10")?.[3]).toBe(9_000);
    expect(rows.find((row) => row[1] === "40")?.[3]).toBe(250);
    expect(rows.find((row) => row[1] === "60")?.[3]).toBe(4_000);
  });

  it("writes balance sheet depreciation as a negative asset contra balance", async () => {
    const balanceSheet: AccountingReportRecord = {
      total_assets: 50_000,
      cash_and_equivalents: 20_000,
      accumulated_depreciation: 7_500,
      total_liabilities: 15_000,
      total_equity: 35_000,
      total_equity_and_liabilities: 50_000,
    };

    const workbook = workbookFromBase64(
      await exportAccountingReportToExcel(
        "balance_sheet",
        balanceSheet,
        "2026-05-31",
      ),
    );
    const rows = rowsFromSheet(workbook, "Balance Sheet");

    expect(rows.find((row) => row[1] === "141")?.[3]).toBe(-7_500);
    expect(rows.find((row) => row[1] === "440")?.[3]).toBe(50_000);
  });

  it("includes cash-flow verification warning when net cash does not reconcile", async () => {
    const cashFlow: AccountingReportRecord = {
      net_change_in_cash: 1_000_000,
      opening_cash: 10_000_000,
      closing_cash: 12_000_000,
      verification_diff: 999_999,
    };

    const workbook = workbookFromBase64(
      await exportAccountingReportToExcel("cash_flow", cashFlow, "2026-05"),
    );
    const rows = rowsFromSheet(workbook, "Cash Flow Statement");

    expect(rows.some((row) => row[2] === 999_999)).toBe(true);
  });
});

describe("exportSalaryToExcel", () => {
  it("writes grouped package commissions and saved salary components", async () => {
    const sessionQuery = mockSessionQuery({
      data: [
        {
          bookings: {
            package_name: "VIP Package",
            ktv_commission: 200_000,
            customers: { name_mother: "Customer A" },
          },
        },
        {
          bookings: {
            package_name: "VIP Package",
            ktv_commission: 200_000,
            customers: { name_mother: "Customer B" },
          },
        },
      ],
      error: null,
    });
    const salaryQuery = mockSalaryQuery({
      base_salary: 6_000_000,
      kpi_bonus: 500_000,
      violations_deduction: 100_000,
      service_percentage_bonus: 50_000,
    });
    const from = jest.fn((table: string) => {
      if (table === "session_logs") return sessionQuery;
      if (table === "salary_records") return salaryQuery;
      throw new Error(`Unexpected table ${table}`);
    });
    mockCreateClient.mockResolvedValueOnce({ from });

    const workbook = workbookFromBase64(
      await exportSalaryToExcel("ktv-1", "KTV A", "2026-05-01"),
    );
    const rows = rowsFromSheet(workbook, "Bang Luong Chi Tiet");

    const vipRow = rows.find((row) => row[1] === "VIP Package");
    expect(vipRow?.[2]).toBe(2);
    expect(String(vipRow?.[4])).toContain("400");
    expect(String(vipRow?.[5])).toContain("Customer A");
    expect(String(vipRow?.[5])).toContain("Customer B");
    expect(from).toHaveBeenCalledWith("session_logs");
    expect(from).toHaveBeenCalledWith("salary_records");
  });

  it("propagates session query failures instead of returning a fake workbook", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const sessionQuery = mockSessionQuery({
      data: null,
      error: new Error("session query failed"),
    });
    const from = jest.fn((table: string) => {
      if (table === "session_logs") return sessionQuery;
      throw new Error(`Unexpected table ${table}`);
    });
    mockCreateClient.mockResolvedValueOnce({ from });

    await expect(
      exportSalaryToExcel("ktv-1", "KTV A", "2026-05-01"),
    ).rejects.toThrow("session query failed");
    expect(from).not.toHaveBeenCalledWith("salary_records");

    consoleError.mockRestore();
  });
});

beforeEach(() => {
  jest.clearAllMocks();
});
