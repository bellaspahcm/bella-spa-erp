process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.CRON_SECRET = "test-cron-secret";

type TenantRow = { id: string; name: string };
type SupabaseError = { message: string };
type QueryResult<T> = { data: T; error: null } | { data: null; error: SupabaseError };
type TelegramConfigRow = {
  telegram_bot_token: string;
  telegram_chat_id: string;
  is_active: boolean;
};
type ConfigQueryBuilder = {
  select: (columns: string) => ConfigQueryBuilder;
  eq: (column: string, value: string | boolean) => ConfigQueryBuilder;
  maybeSingle: () => Promise<QueryResult<TelegramConfigRow | null>>;
};

const mockRpc = jest.fn();
let mockTenantsResult: QueryResult<TenantRow[]> = { data: [], error: null };
let mockConfigResults: Record<string, QueryResult<TelegramConfigRow | null>> = {};

function createTenantQuery() {
  return {
    select: jest.fn(() => ({
      eq: jest.fn(async () => mockTenantsResult),
    })),
  };
}

function createConfigQuery() {
  let selectedTenantId = "";
  const builder: ConfigQueryBuilder = {
    select: jest.fn(() => builder),
    eq: jest.fn((column: string, value: string | boolean) => {
      if (column === "tenant_id") {
        selectedTenantId = String(value);
      }
      return builder;
    }),
    maybeSingle: jest.fn(async () => (
      mockConfigResults[selectedTenantId] ?? { data: null, error: null }
    )),
  };
  return builder;
}

const mockSupabase = {
  from: jest.fn((table: string) => {
    if (table === "tenants") {
      return createTenantQuery();
    }

    if (table === "ai_agent_configs") {
      return createConfigQuery();
    }

    throw new Error(`Unexpected table ${table}`);
  }),
  rpc: mockRpc,
};

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => mockSupabase),
}));

jest.mock("@/lib/crypto", () => ({
  decrypt: jest.fn((value: string) => `decrypted-${value}`),
}));

import { GET } from "@/app/api/cron/ai-autopilot/route";
import { NextRequest } from "next/server";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function authorizedRequest() {
  return new NextRequest("http://localhost/api/cron/ai-autopilot", {
    method: "GET",
    headers: {
      Authorization: "Bearer test-cron-secret",
    },
  });
}

function activeConfig(token = "encrypted-token"): QueryResult<TelegramConfigRow> {
  return {
    data: {
      telegram_bot_token: token,
      telegram_chat_id: "chat-1",
      is_active: true,
    },
    error: null,
  };
}

function mockAnomalyRpc() {
  mockRpc.mockImplementation(async (fn: string) => {
    if (fn === "set_session_tenant") {
      return { data: null, error: null };
    }

    if (fn === "get_ai_attendance_kpis") {
      return {
        data: [
          {
            ktv_name: "KTV Hoa",
            gps_anomaly_count: 1,
            late_count: 0,
          },
        ],
        error: null,
      };
    }

    if (fn === "get_reconciliation_report") {
      return { data: [], error: null };
    }

    throw new Error(`Unexpected RPC ${fn}`);
  });
}

describe("AI Autopilot Cron", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    process.env.CRON_SECRET = "test-cron-secret";
    mockTenantsResult = { data: [], error: null };
    mockConfigResults = {};
    mockFetch.mockReset();
    mockRpc.mockReset();
  });

  it("reports tenant failure when Telegram config query fails", async () => {
    mockTenantsResult = { data: [{ id: "tenant-1", name: "Bella A" }], error: null };
    mockConfigResults = {
      "tenant-1": { data: null, error: { message: "config db down" } },
    };

    const response = await GET(authorizedRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(false);
    expect(body.status).toBe("partial_failure");
    expect(body.alerts_sent).toBe(0);
    expect(body.alerts_failed).toBe(0);
    expect(body.tenant_errors).toEqual([
      {
        tenant_id: "tenant-1",
        tenant_name: "Bella A",
        error: "Failed to fetch Telegram config: config db down",
      },
    ]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("reports Telegram delivery failure instead of returning false success", async () => {
    mockTenantsResult = { data: [{ id: "tenant-1", name: "Bella A" }], error: null };
    mockConfigResults = { "tenant-1": activeConfig() };
    mockAnomalyRpc();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => "telegram rate limited",
    });

    const response = await GET(authorizedRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(false);
    expect(body.status).toBe("partial_failure");
    expect(body.alerts_sent).toBe(0);
    expect(body.alerts_failed).toBe(1);
    expect(body.tenant_errors).toHaveLength(1);
    expect(body.tenant_errors[0]).toMatchObject({
      tenant_id: "tenant-1",
      tenant_name: "Bella A",
      error: "Telegram delivery failed: telegram rate limited",
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("counts a sent alert when Telegram delivery succeeds", async () => {
    mockTenantsResult = { data: [{ id: "tenant-1", name: "Bella A" }], error: null };
    mockConfigResults = { "tenant-1": activeConfig("secret-token") };
    mockAnomalyRpc();
    mockFetch.mockResolvedValueOnce({ ok: true });

    const response = await GET(authorizedRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.status).toBe("success");
    expect(body.alerts_sent).toBe(1);
    expect(body.alerts_failed).toBe(0);
    expect(body.tenant_errors).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.telegram.org/botdecrypted-secret-token/sendMessage",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("continues later tenants after one Telegram delivery failure", async () => {
    mockTenantsResult = {
      data: [
        { id: "tenant-1", name: "Bella A" },
        { id: "tenant-2", name: "Bella B" },
      ],
      error: null,
    };
    mockConfigResults = {
      "tenant-1": activeConfig("token-a"),
      "tenant-2": activeConfig("token-b"),
    };
    mockAnomalyRpc();
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        text: async () => "bot blocked",
      })
      .mockResolvedValueOnce({ ok: true });

    const response = await GET(authorizedRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(false);
    expect(body.status).toBe("partial_failure");
    expect(body.alerts_sent).toBe(1);
    expect(body.alerts_failed).toBe(1);
    expect(body.tenant_errors).toEqual([
      {
        tenant_id: "tenant-1",
        tenant_name: "Bella A",
        error: "Telegram delivery failed: bot blocked",
      },
    ]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockRpc).toHaveBeenCalledWith("set_session_tenant", { p_tenant_id: "tenant-2" });
  });
});
