import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase-server";
import {
  exportAccountingReportToExcel,
  exportAccountingReportToExcelResult,
  exportSalaryToExcel,
  exportSessionMatrixToExcel,
  exportSessionMatrixToExcelResult,
  type AccountingReportRecord,
  type TrialBalanceExportRow,
} from "@/services/export-actions";

jest.mock("@/lib/supabase-server", () => ({
  createClient: jest.fn(),
}));

const mockGetCurrentUser = jest.fn();

jest.mock("@/services/user-actions", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
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
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    gte: jest.fn(() => query),
    lt: jest.fn(() => Promise.resolve(result)),
  };
  return query;
}

function mockPackagesQuery(data: Record<string, unknown>[] | null = [], error: Error | null = null) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn().mockResolvedValue({ data, error }),
  };
  return query;
}

function mockSalarySheetRpc(data: Record<string, unknown>[] | null, error: Error | null = null) {
  return jest.fn().mockResolvedValue({ data, error });
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

  it("treats missing and non-numeric package cells as zero in totals", async () => {
    const base64 = await exportSessionMatrixToExcel(
      [
        { name: "KTV A", "Basic Care": "2", "VIP Care": null },
        { name: "KTV B", "Basic Care": "not-a-number", "VIP Care": 1 },
      ],
      ["Basic Care", "VIP Care"],
    );

    const rows = rowsFromSheet(workbookFromBase64(base64), "Doi Soat Buoi Lam");
    expect(rows.find((row) => row[0] === "KTV A")).toEqual(["KTV A", 2, 0, 2]);
    expect(rows.find((row) => row[0] === "KTV B")).toEqual(["KTV B", 0, 1, 1]);
  });

  it("returns an explicit failure result when matrix workbook generation fails", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await exportSessionMatrixToExcelResult(
      undefined as unknown as Parameters<typeof exportSessionMatrixToExcelResult>[0],
      [],
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("forEach");
    }
    consoleError.mockRestore();
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

  it("sums numeric string amounts in trial balance totals", async () => {
    const rows: TrialBalanceExportRow[] = [
      {
        account_code: "111",
        account_name: "Cash",
        opening_debit: "1000",
        opening_credit: "0",
        period_debit: "2500",
        period_credit: "500",
        closing_debit: "3000",
        closing_credit: "0",
      },
    ];

    const workbook = workbookFromBase64(
      await exportAccountingReportToExcel("trial_balance", rows, "2026-05-31"),
    );

    expect(rowsFromSheet(workbook, "Trial Balance").at(-1)?.slice(2)).toEqual([
      1_000,
      0,
      2_500,
      500,
      3_000,
      0,
    ]);
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

  it("maps cash-flow operating, investing, financing, and closing cash rows", async () => {
    const cashFlow: AccountingReportRecord = {
      profit_before_tax: 6_000_000,
      depreciation: 500_000,
      change_in_receivables: -200_000,
      change_in_inventory: 100_000,
      change_in_payables: 800_000,
      change_in_unearned_revenue: 1_500_000,
      tax_paid: 0,
      net_cash_operating: 8_900_000,
      fixed_assets_purchased: -4_000_000,
      fixed_assets_sold: 0,
      net_cash_investing: -4_000_000,
      owner_contributions: 2_000_000,
      loans_received: 1_000_000,
      loans_repaid: -500_000,
      net_cash_financing: 2_500_000,
      net_change_in_cash: 7_400_000,
      opening_cash: 10_000_000,
      closing_cash: 17_400_000,
      verification_diff: 0,
    };

    const workbook = workbookFromBase64(
      await exportAccountingReportToExcel("cash_flow", cashFlow, "2026-05"),
    );
    const rows = rowsFromSheet(workbook, "Cash Flow Statement");

    expect(rows.find((row) => row[1] === "01")?.[2]).toBe(6_000_000);
    expect(rows.filter((row) => row[1] === "20").at(-1)?.[2]).toBe(8_900_000);
    expect(rows.filter((row) => row[1] === "30").at(-1)?.[2]).toBe(-4_000_000);
    expect(rows.filter((row) => row[1] === "40").at(-1)?.[2]).toBe(2_500_000);
    expect(rows.find((row) => row[1] === "70")?.[2]).toBe(17_400_000);
  });

  it("returns an explicit failure result when accounting workbook generation fails", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const invalidCashFlow = {};
    Object.defineProperty(invalidCashFlow, "net_cash_operating", {
      get() {
        throw new Error("accounting data failed");
      },
    });

    const result = await exportAccountingReportToExcelResult(
      "cash_flow",
      invalidCashFlow as AccountingReportRecord,
      "2026-05-31",
    );

    expect(result).toEqual({ success: false, error: "accounting data failed" });
    consoleError.mockRestore();
  });
});

describe("exportSalaryToExcel", () => {
  it("writes grouped package commissions and central salary sheet components", async () => {
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
    const rpc = mockSalarySheetRpc([{
      ktv_id: "ktv-1",
      base_salary: 6_000_000,
      session_bonus: 400_000,
      rating_bonus: 75_000,
      kpi_bonus: 500_000,
      deductions: 100_000,
      advances: 50_000,
      total_salary: 6_825_000,
      total_sessions: 4,
      status: "published",
    }]);
    const packagesQuery = mockPackagesQuery([{ name: "VIP Package", session_multiplier: 2 }]);
    const from = jest.fn((table: string) => {
      if (table === "session_logs") return sessionQuery;
      if (table === "packages") return packagesQuery;
      throw new Error(`Unexpected table ${table}`);
    });
    mockCreateClient.mockResolvedValueOnce({ from, rpc });

    const workbook = workbookFromBase64(
      await exportSalaryToExcel("ktv-1", "KTV A", "2026-05-01"),
    );
    const rows = rowsFromSheet(workbook, "Bang Luong Chi Tiet");

    const vipRow = rows.find((row) => row[1] === "VIP Package");
    expect(vipRow?.[2]).toBe(4);
    expect(String(vipRow?.[4])).toContain("400");
    expect(String(vipRow?.[5])).toContain("Customer A");
    expect(String(vipRow?.[5])).toContain("Customer B");
    expect(rows.some((row) => String(row[4]).includes("6.825.000"))).toBe(true);
    expect(rows.find((row) => String(row[0]).startsWith("2."))?.[2]).toBe("4 buổi");
    expect(from).toHaveBeenCalledWith("session_logs");
    expect(from).not.toHaveBeenCalledWith("salary_records");
    expect(from).toHaveBeenCalledWith("packages");
    expect(rpc).toHaveBeenCalledWith("calculate_ktv_salary_sheet", {
      p_month_year: "2026-05-01",
    });
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
    const rpc = mockSalarySheetRpc([]);
    mockCreateClient.mockResolvedValueOnce({ from, rpc });

    await expect(
      exportSalaryToExcel("ktv-1", "KTV A", "2026-05-01"),
    ).rejects.toThrow("session query failed");
    expect(rpc).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it("propagates salary sheet RPC failures instead of using fallback salary amounts", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const sessionQuery = mockSessionQuery({
      data: [
        {
          bookings: {
            package_name: "VIP Package",
            ktv_commission: 200_000,
            customers: { name_mother: "Customer A" },
          },
        },
      ],
      error: null,
    });
    const rpc = mockSalarySheetRpc(null, new Error("salary sheet failed"));
    const from = jest.fn((table: string) => {
      if (table === "session_logs") return sessionQuery;
      throw new Error(`Unexpected table ${table}`);
    });
    mockCreateClient.mockResolvedValueOnce({ from, rpc });

    await expect(
      exportSalaryToExcel("ktv-1", "KTV A", "2026-05-01"),
    ).rejects.toThrow("salary sheet failed");
    expect(from).not.toHaveBeenCalledWith("packages");

    consoleError.mockRestore();
  });

  it("rejects salary export when the central salary sheet has no KTV row", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const sessionQuery = mockSessionQuery({ data: [], error: null });
    const packagesQuery = mockPackagesQuery([]);
    const rpc = mockSalarySheetRpc([{ ktv_id: "ktv-other", total_salary: 1 }]);
    const from = jest.fn((table: string) => {
      if (table === "session_logs") return sessionQuery;
      if (table === "packages") return packagesQuery;
      throw new Error(`Unexpected table ${table}`);
    });
    mockCreateClient.mockResolvedValueOnce({ from, rpc });

    await expect(
      exportSalaryToExcel("ktv-1", "KTV A", "2026-05-01"),
    ).rejects.toThrow("Salary sheet row not found for KTV ktv-1 in 2026-05-01");

    consoleError.mockRestore();
  });

  it("uses the displayed salary snapshot when the central sheet has no KTV row", async () => {
    const sessionQuery = mockSessionQuery({ data: [], error: null });
    const packagesQuery = mockPackagesQuery([]);
    const rpc = mockSalarySheetRpc([{ ktv_id: "ktv-other", total_salary: 1 }]);
    const from = jest.fn((table: string) => {
      if (table === "session_logs") return sessionQuery;
      if (table === "packages") return packagesQuery;
      throw new Error(`Unexpected table ${table}`);
    });
    mockCreateClient.mockResolvedValueOnce({ from, rpc });

    const workbook = workbookFromBase64(
      await exportSalaryToExcel("ktv-1", "KTV A", "2026-05-01", {
        ktvId: "ktv-1",
        baseSalary: 992_308,
        sessionBonus: 0,
        ratingBonus: 0,
        kpiBonus: 0,
        deductions: 150_000,
        advances: 0,
        totalSalary: 842_308,
        sessions: 0,
        status: "draft",
      }),
    );
    const rows = rowsFromSheet(workbook, "Bang Luong Chi Tiet");

    expect(rows.some((row) => String(row[4]).includes("842.308"))).toBe(true);
    expect(rows.find((row) => String(row[0]).startsWith("2."))?.[2]).toBe("0 buổi");
    expect(rpc).toHaveBeenCalledWith("calculate_ktv_salary_sheet", {
      p_month_year: "2026-05-01",
    });
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue({
    id: "admin-1",
    role: "admin",
    tenant_id: "tenant-1",
  });
});
