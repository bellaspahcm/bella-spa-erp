import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize standard Supabase client without cookies for webhook execution
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

interface Transaction {
  amount: number;
  description: string;
  transactionId: string;
  receivedDate: string;
}

// Extract transactions from multiple platforms: Casso, SePay, PayOS
function extractTransactions(body: any): Transaction[] {
  const txs: Transaction[] = [];

  // SePay format
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    if (body.transferAmount !== undefined || body.content !== undefined) {
      txs.push({
        amount: Number(body.transferAmount || body.amount || 0),
        description: body.content || body.description || '',
        transactionId: String(body.code || body.id || ''),
        receivedDate: body.transactionDate || new Date().toISOString()
      });
      return txs;
    }
  }

  // PayOS format
  if (body && body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    if (body.data.amount !== undefined && body.data.description !== undefined) {
      txs.push({
        amount: Number(body.data.amount || 0),
        description: body.data.description || '',
        transactionId: String(body.data.reference || body.data.orderCode || ''),
        receivedDate: new Date().toISOString()
      });
      return txs;
    }
  }

  // Casso standard format
  if (body && Array.isArray(body.data)) {
    body.data.forEach((item: any) => {
      txs.push({
        amount: Number(item.amount || 0),
        description: item.description || '',
        transactionId: String(item.tid || item.id || ''),
        receivedDate: item.when || new Date().toISOString()
      });
    });
    return txs;
  }

  // Casso webhook events format
  if (body && Array.isArray(body.events)) {
    body.events.forEach((event: any) => {
      if (event.data && Array.isArray(event.data)) {
        event.data.forEach((item: any) => {
          txs.push({
            amount: Number(item.amount || 0),
            description: item.description || '',
            transactionId: String(item.tid || item.id || ''),
            receivedDate: item.when || new Date().toISOString()
          });
        });
      }
    });
    return txs;
  }

  // Fallback: array of transactions directly
  if (Array.isArray(body)) {
    body.forEach((item: any) => {
      txs.push({
        amount: Number(item.amount || item.transferAmount || 0),
        description: item.description || item.content || '',
        transactionId: String(item.tid || item.code || item.id || ''),
        receivedDate: item.when || item.transactionDate || new Date().toISOString()
      });
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

    const body = await request.json();
    console.log("[Payment Webhook] Request body:", JSON.stringify(body));

    const transactions = extractTransactions(body);
    console.log("[Payment Webhook] Extracted transactions count:", transactions.length);

    if (transactions.length === 0) {
      return NextResponse.json({ success: true, message: "No valid transactions found in payload" });
    }

    const results = [];

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
        const { data: renewSuccess, error: renewErr } = await supabase.rpc('renew_tenant_subscription', {
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

      // 3. Find booking in database
      const { data: booking, error: bookingErr } = await supabase
        .from("bookings")
        .select("*")
        .eq("booking_number", bookingNumber)
        .maybeSingle();

      if (bookingErr || !booking) {
        console.error(`[Payment Webhook] Booking "${bookingNumber}" not found or DB error:`, bookingErr);
        results.push({ transactionId, bookingNumber, status: "failed", reason: `Booking "${bookingNumber}" not found` });
        continue;
      }

      // Check for duplicate transaction processing by querying existing revenues
      const { data: existingRevenue } = await supabase
        .from("revenue")
        .select("id")
        .eq("booking_id", booking.id)
        .like("notes", `%${transactionId}%`)
        .maybeSingle();

      if (existingRevenue) {
        console.log(`[Payment Webhook] Skip Transaction ${transactionId}: Transaction already processed (Revenue ID: ${existingRevenue.id})`);
        results.push({ transactionId, bookingNumber, status: "skipped", reason: "Already processed" });
        continue;
      }

      // 4. Update booking status and record revenue
      let revenueType = "additional";
      const oldStatus = booking.status;

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
      const cleanDate = receivedDate ? new Date(receivedDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      const { data: newRevenue, error: revErr } = await supabase
        .from("revenue")
        .insert([{
          booking_id: booking.id,
          amount: amount,
          revenue_type: revenueType,
          payment_method: "VietQR",
          received_date: cleanDate,
          status: "confirmed",
          notes: `[Đối soát Webhook] Tự động gạch nợ thành công qua VietQR. Mã GD ngân hàng: ${transactionId}. Nội dung CK: ${description}`,
          tenant_id: booking.tenant_id
        }])
        .select()
        .single();

      if (revErr || !newRevenue) {
        console.error(`[Payment Webhook] Failed to insert revenue for "${bookingNumber}":`, revErr);
        results.push({ transactionId, bookingNumber, status: "failed", reason: "Failed to insert revenue record" });
        continue;
      }
      console.log(`[Payment Webhook] Successfully inserted revenue ID: ${newRevenue.id}`);

      // 6. Record Audit Log
      try {
        const { error: auditErr } = await supabase.from('audit_logs').insert({
          action: "INSERT",
          table_name: "revenue",
          record_id: newRevenue.id,
          new_data: newRevenue,
          tenant_id: booking.tenant_id,
          changed_by_id: null // Webhook auto execution
        });
        if (auditErr) {
          console.warn("[Payment Webhook] Failed to insert audit log:", auditErr.message);
        } else {
          console.log(`[Payment Webhook] Audit log recorded successfully`);
        }
      } catch (auditErr) {
        console.warn(`[Payment Webhook] Non-critical warning: Failed to record audit log:`, auditErr);
      }

      results.push({ transactionId, bookingNumber, status: "success", revenueId: newRevenue.id });
    }

    return NextResponse.json({ success: true, processedCount: results.filter(r => r.status === "success").length, details: results });
  } catch (error: any) {
    console.error("[Payment Webhook] Exception error in POST route:", error);
    return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
  }
}
