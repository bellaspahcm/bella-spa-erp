import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enqueueWithAutoClient } from "@/lib/accounting-outbox";
import { safeStringify } from "@/lib/log-redactor";
import { assertOpenAccountingPeriod } from "@/services/accounting/period-guards";
import { findMissingRequiredFields, inferBusinessEventType } from "@/services/accounting/template-rules";
import type { Database } from "@/types/database.types";

function createWebhookSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}

interface Transaction {
  amount: number;
  description: string;
  transactionId: string;
  receivedDate: string;
}

type WebhookRecord = Record<string, unknown>;
type ProcessingResult = {
  transactionId: string;
  status: "success" | "failed" | "skipped";
  invoiceNumber?: string;
  bookingNumber?: string;
  type?: "subscription";
  revenueId?: string;
  reason?: string;
};

function resolveAccountingReviewStatus(
  businessEventType: ReturnType<typeof inferBusinessEventType>,
  payload: Record<string, unknown>
) {
  if (!businessEventType) return "NEEDS_REVIEW";
  return findMissingRequiredFields(businessEventType, payload).length > 0
    ? "NEEDS_REVIEW"
    : "UNREVIEWED";
}

function isRecord(value: unknown): value is WebhookRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function firstPresent(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function readString(value: unknown, fallback = "") {
  const present = firstPresent(value);
  if (present === undefined) return fallback;
  return String(present);
}

function readNumber(...values: unknown[]) {
  const present = firstPresent(...values);
  if (present === undefined) return 0;

  const parsed = Number(present);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readReceivedDate(...values: unknown[]) {
  const present = firstPresent(...values);
  return typeof present === "string" && present.trim() ? present : new Date().toISOString();
}

function transactionFromRecord(
  item: WebhookRecord,
  options: {
    amountKeys: string[];
    descriptionKeys: string[];
    idKeys: string[];
    dateKeys: string[];
  }
): Transaction {
  return {
    amount: readNumber(...options.amountKeys.map((key) => item[key])),
    description: readString(firstPresent(...options.descriptionKeys.map((key) => item[key]))),
    transactionId: readString(firstPresent(...options.idKeys.map((key) => item[key]))),
    receivedDate: readReceivedDate(...options.dateKeys.map((key) => item[key])),
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

// Extract transactions from multiple platforms: Casso, SePay, PayOS
function extractTransactions(body: unknown): Transaction[] {
  const txs: Transaction[] = [];

  // SePay format
  if (isRecord(body)) {
    if (body.transferAmount !== undefined || body.content !== undefined) {
      txs.push(transactionFromRecord(body, {
        amountKeys: ["transferAmount", "amount"],
        descriptionKeys: ["content", "description"],
        idKeys: ["code", "id"],
        dateKeys: ["transactionDate"],
      }));
      return txs;
    }
  }

  // PayOS format
  if (isRecord(body) && isRecord(body.data)) {
    if (body.data.amount !== undefined && body.data.description !== undefined) {
      txs.push(transactionFromRecord(body.data, {
        amountKeys: ["amount"],
        descriptionKeys: ["description"],
        idKeys: ["reference", "orderCode"],
        dateKeys: [],
      }));
      return txs;
    }
  }

  // Casso standard format
  if (isRecord(body) && Array.isArray(body.data)) {
    body.data.forEach((item) => {
      if (!isRecord(item)) return;
      txs.push(transactionFromRecord(item, {
        amountKeys: ["amount"],
        descriptionKeys: ["description"],
        idKeys: ["tid", "id"],
        dateKeys: ["when"],
      }));
    });
    return txs;
  }

  // Casso webhook events format
  if (isRecord(body) && Array.isArray(body.events)) {
    body.events.forEach((event) => {
      if (isRecord(event) && Array.isArray(event.data)) {
        event.data.forEach((item) => {
          if (!isRecord(item)) return;
          txs.push(transactionFromRecord(item, {
            amountKeys: ["amount"],
            descriptionKeys: ["description"],
            idKeys: ["tid", "id"],
            dateKeys: ["when"],
          }));
        });
      }
    });
    return txs;
  }

  // Fallback: array of transactions directly
  if (Array.isArray(body)) {
    body.forEach((item) => {
      if (!isRecord(item)) return;
      txs.push(transactionFromRecord(item, {
        amountKeys: ["amount", "transferAmount"],
        descriptionKeys: ["description", "content"],
        idKeys: ["tid", "code", "id"],
        dateKeys: ["when", "transactionDate"],
      }));
    });
    return txs;
  }

  return txs;
}

import { timingSafeEqual } from "crypto";

function secureCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request: NextRequest) {
  console.log("[Payment Webhook] Received request at:", new Date().toISOString());
  
  try {
    // 1. Authenticate the webhook request
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    
    if (!secret) {
      console.error("[Payment Webhook] CRITICAL: PAYMENT_WEBHOOK_SECRET is not configured.");
      return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    const apiKeyHeader = request.headers.get("x-api-key");
    const { searchParams } = new URL(request.url);
    const querySecret = searchParams.get("secret");

    const providedSecret = querySecret || 
                           (authHeader ? authHeader.replace("Bearer ", "") : null) || 
                           apiKeyHeader || "";

    if (!secureCompare(secret, providedSecret)) {
      console.warn("[Payment Webhook] Unauthorized request.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await request.json();
    console.log("[Payment Webhook] Request body:", safeStringify(body));

    const transactions = extractTransactions(body);
    console.log("[Payment Webhook] Extracted transactions count:", transactions.length);

    if (transactions.length === 0) {
      return NextResponse.json({ success: true, message: "No valid transactions found in payload" });
    }

    let supabase: ReturnType<typeof createWebhookSupabaseClient>;
    try {
      supabase = createWebhookSupabaseClient();
    } catch (configError: unknown) {
      console.error("[Payment Webhook] Supabase server credentials are not configured:", getErrorMessage(configError));
      return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    const results: ProcessingResult[] = [];

    for (const tx of transactions) {
      const { amount, description, transactionId, receivedDate } = tx;
      console.log(`[Payment Webhook] Processing Transaction ID: ${transactionId}, Amount: ${amount}, Desc: "${description}"`);

      // 2a. Check if it's a subscription payment: SUB [invoice_number] (e.g. SUB INV-1002, SUB-1002)
      const subRegex = /SUB\s*([\w\-]+)/i;
      const subMatch = description.match(subRegex);

      if (subMatch) {
        const invoiceNumber = subMatch[1].trim().toUpperCase().replace(/^[-_]+/, "");
        console.log(`[Payment Webhook] Match found! Subscription Invoice Number: "${invoiceNumber}"`);
        
        // Execute the RPC to renew the subscription
        const { error: renewErr } = await supabase.rpc('renew_tenant_subscription', {
          p_invoice_number: invoiceNumber,
          p_payment_method: "VietQR"
        });

        if (renewErr) {
          console.error(`[Payment Webhook] Failed to renew subscription for "${invoiceNumber}":`, renewErr);
          results.push({ transactionId, invoiceNumber, status: "failed", reason: renewErr.message });
          continue;
        }

        console.log(`[Payment Webhook] Successfully renewed subscription for invoice: ${invoiceNumber}`);
        results.push({ transactionId, invoiceNumber, status: "success", type: "subscription" });
        continue;
      }

      // 2b. Extract booking number using Regex: BELLA [booking_number] (e.g. BELLA B10029, BELLA BK-10029)
      const regex = /BELLA\s*([\w\-]+)/i;
      const match = description.match(regex);

      if (!match) {
        console.log(`[Payment Webhook] Skip Transaction ${transactionId}: Description does not match BELLA or SUB pattern`);
        results.push({ transactionId, status: "skipped", reason: "Description does not match BELLA or SUB pattern" });
        continue;
      }

      const bookingNumber = match[1].trim().toUpperCase().replace(/^[-_]+/, "");
      console.log(`[Payment Webhook] Match found! Booking Number: "${bookingNumber}"`);

      // 3. Find booking in database — scope by booking_number only (unique constraint).
      // Service-role client bypasses RLS so we verify tenant_id after fetch (defense-in-depth).
      const { data: booking, error: bookingErr } = await supabase
        .from("bookings")
        .select("*")
        .eq("booking_number", bookingNumber)
        .not("tenant_id", "is", null)
        .maybeSingle();

      if (bookingErr || !booking) {
        console.error(`[Payment Webhook] Booking "${bookingNumber}" not found or DB error:`, bookingErr);
        results.push({ transactionId, bookingNumber, status: "failed", reason: `Booking "${bookingNumber}" not found` });
        continue;
      }

      // Check for duplicate transaction processing by querying existing revenues
      const { data: existingRevenue, error: existingRevenueErr } = await supabase
        .from("revenue")
        .select("id")
        .eq("booking_id", booking.id)
        .like("notes", `%${transactionId}%`)
        .maybeSingle();

      if (existingRevenueErr) {
        console.error(`[Payment Webhook] Failed to check duplicate transaction for "${bookingNumber}":`, existingRevenueErr);
        results.push({ transactionId, bookingNumber, status: "failed", reason: "Failed to check duplicate transaction" });
        continue;
      }

      if (existingRevenue) {
        console.log(`[Payment Webhook] Skip Transaction ${transactionId}: Transaction already processed (Revenue ID: ${existingRevenue.id})`);
        results.push({ transactionId, bookingNumber, status: "skipped", reason: "Already processed" });
        continue;
      }

      // 4. Update booking status and record revenue
      let revenueType: NonNullable<Database["public"]["Tables"]["revenue"]["Insert"]["revenue_type"]> = "additional";
      const oldStatus = booking.status;
      const cleanDate = receivedDate ? new Date(receivedDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

      try {
        await assertOpenAccountingPeriod(supabase, {
          tenantId: booking.tenant_id,
          date: cleanDate,
          context: `Payment webhook booking ${bookingNumber}`,
        });
      } catch (periodErr) {
        const reason = periodErr instanceof Error ? periodErr.message : "Accounting period is closed";
        results.push({ transactionId, bookingNumber, status: "failed", reason });
        continue;
      }

      // If the booking is in deposit_pending or inquiry state, change status to 'booked' and set revenueType to 'deposit'
      if (oldStatus === "deposit_pending" || oldStatus === "inquiry") {
        revenueType = "deposit";
        
        const { error: updateErr } = await supabase
          .from("bookings")
          .update({ status: "booked" })
          .eq("id", booking.id);

        if (updateErr) {
          console.error(`[Payment Webhook] Failed to update booking status for "${bookingNumber}":`, updateErr);
          results.push({ transactionId, bookingNumber, status: "failed", reason: "Failed to update booking status" });
          continue;
        }
        console.log(`[Payment Webhook] Updated Booking status from "${oldStatus}" to "booked"`);
      }

      // 5. Insert revenue entry
      const businessEventType = inferBusinessEventType({
        sourceTable: "revenue",
        revenueType,
      });
      const accountingPayload = {
        amount,
        payment_method: "VietQR",
        booking_id: booking.id,
        reason: `Webhook VietQR transaction ${transactionId}: ${description}`,
      };
      const revenuePayload: Database["public"]["Tables"]["revenue"]["Insert"] = {
        booking_id: booking.id,
        amount,
        revenue_type: revenueType,
        payment_method: "VietQR",
        received_date: cleanDate,
        status: "confirmed",
        notes: `[Đối soát Webhook] Tự động đối soát thành công qua VietQR. Mã GD ngân hàng: ${transactionId}. Nội dung CK: ${description}`,
        tenant_id: booking.tenant_id,
        business_event_type: businessEventType,
        accounting_review_status: resolveAccountingReviewStatus(businessEventType, accountingPayload),
        accounting_metadata: accountingPayload,
      };
      const { data: newRevenue, error: revErr } = await supabase
        .from("revenue")
        .insert([revenuePayload])
        .select()
        .single();

      if (revErr || !newRevenue) {
        console.error(`[Payment Webhook] Failed to insert revenue for "${bookingNumber}":`, revErr);
        results.push({ transactionId, bookingNumber, status: "failed", reason: "Failed to insert revenue record" });
        continue;
      }
      console.log(`[Payment Webhook] Successfully inserted revenue ID: ${newRevenue.id}`);

      const rollbackWebhookRevenue = async (reason: string) => {
        const { error: deleteRevenueErr } = await supabase
          .from("revenue")
          .delete()
          .eq("id", newRevenue.id);

        if (deleteRevenueErr) {
          throw new Error(`[Payment Webhook] Failed to rollback revenue ${newRevenue.id}: ${deleteRevenueErr.message}`);
        }

        if (oldStatus === "deposit_pending" || oldStatus === "inquiry") {
          const { error: rollbackBookingErr } = await supabase
            .from("bookings")
            .update({ status: oldStatus })
            .eq("id", booking.id);

          if (rollbackBookingErr) {
            throw new Error(`[Payment Webhook] Failed to rollback booking ${booking.id}: ${rollbackBookingErr.message}`);
          }
        }

        results.push({ transactionId, bookingNumber, status: "failed", reason });
      };

      // 6. Record Audit Log
      const auditPayload: Database["public"]["Tables"]["audit_logs"]["Insert"] = {
        action: "INSERT",
        table_name: "revenue",
        record_id: newRevenue.id,
        new_data: newRevenue,
        tenant_id: booking.tenant_id,
        changed_by_id: null,
      };
      const { error: auditErr } = await supabase.from("audit_logs").insert(auditPayload);
      if (auditErr) {
        console.error("[Payment Webhook] Failed to insert audit log:", auditErr.message);
        await rollbackWebhookRevenue("Failed to insert audit log");
        continue;
      }
      console.log(`[Payment Webhook] Audit log recorded successfully`);

      const outboxEnqueued = await enqueueWithAutoClient(
        supabase,
        {
          tenantId: booking.tenant_id,
          eventType: "PACKAGE_SALE",
          referenceType: "REVENUE",
          referenceId: newRevenue.id,
          payload: {
            totalAmount: amount,
            vatRate: 0,
            description: revenuePayload.notes || "VietQR webhook payment",
            branchId: booking.tenant_id,
          },
        },
        "[Payment Webhook]"
      );

      if (!outboxEnqueued) {
        await rollbackWebhookRevenue("Failed to enqueue accounting outbox");
        continue;
      }

      results.push({ transactionId, bookingNumber, status: "success", revenueId: newRevenue.id });
    }

    return NextResponse.json({ success: true, processedCount: results.filter(r => r.status === "success").length, details: results });
  } catch (error: unknown) {
    console.error("[Payment Webhook] Exception error in POST route:", error);
    console.error("[Payment Webhook] Exception message:", getErrorMessage(error));
    return NextResponse.json({ error: "Đã xảy ra lỗi hệ thống." }, { status: 500 });
  }
}
