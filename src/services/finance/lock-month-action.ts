'use server';

import { revalidatePath } from 'next/cache';
import * as Sentry from '@sentry/nextjs';

export async function lockMonth(month: string) {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = await createClient();

    const { getCurrentUser } = await import('../user-actions');
    const user = await getCurrentUser();
    
    if (!user) return { success: false, error: 'Chưa đăng nhập' };
    if (user.role !== 'admin') {
      return { success: false, error: 'Chỉ Admin mới có thể khóa sổ tháng' };
    }
    
    if (!user.tenant_id) return { success: false, error: 'Không tìm thấy tenant_id' };

    const { error } = await supabase.rpc('lock_monthly_records', {
      p_tenant_id: user.tenant_id,
      p_month: month
    });

    if (error) {
      console.error('[lockMonth] RPC error:', error);
      return { success: false, error: 'Lỗi khóa sổ: ' + error.message };
    }

    // ─── Franchise Royalty Auto-Billing System Integration ──────────────────
    try {
      const { data: tenant, error: tenantErr } = await supabase
        .from('tenants')
        .select('name, royalty_type, royalty_rate, royalty_fixed_amount')
        .eq('id', user.tenant_id)
        .single();

      if (tenantErr || !tenant) {
        throw new Error(`[lockMonth] Failed to retrieve tenant config for royalty calculations: ${tenantErr?.message || 'Tenant not found'}`);
      } else {
        const startDate = new Date(month);
        const startYear = startDate.getFullYear();
        const startMonth = startDate.getMonth();
        const startDateStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(startYear, startMonth + 1, 0).getDate();
        const endDateStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const { data: revenues, error: revError } = await supabase
          .from('revenue')
          .select('amount')
          .eq('tenant_id', user.tenant_id)
          .eq('status', 'confirmed')
          .gte('received_date', startDateStr)
          .lte('received_date', endDateStr);

        if (revError) {
          throw new Error(`[lockMonth] Failed to fetch revenues for royalty calculation: ${revError.message}`);
        } else {
          const grossRevenue = (revenues || []).reduce((sum: number, r) => sum + (Number(r.amount) || 0), 0);
          
          const royaltyType = tenant.royalty_type || 'percentage';
          let calculatedAmount = 0;
          if (royaltyType === 'percentage') {
            calculatedAmount = (grossRevenue * (Number(tenant.royalty_rate) || 0)) / 100;
          } else {
            calculatedAmount = Number(tenant.royalty_fixed_amount) || 0;
          }

          // Generate a premium distinct invoice number
          const nameParts = (tenant.name || 'BRANCH').split(' ');
          const abbreviation = nameParts.map((p: string) => p[0]).join('').toUpperCase().slice(0, 5);
          const randomSuffix = Math.floor(1000 + Math.random() * 9000);
          const yearMonth = month.substring(0, 7).replace('-', '');
          const invoiceNumber = `ROY-${yearMonth}-${abbreviation}-${randomSuffix}`;

          const { data: existingInvoice } = await supabase
            .from('franchise_royalty_invoices')
            .select('id, status')
            .eq('tenant_id', user.tenant_id)
            .eq('month_year', startDateStr)
            .maybeSingle();

          if (existingInvoice) {
            if (existingInvoice.status !== 'paid') {
              const { error: invoiceUpdateError } = await supabase
                .from('franchise_royalty_invoices')
                .update({
                  gross_revenue: grossRevenue,
                  royalty_type: royaltyType,
                  royalty_rate: tenant.royalty_rate,
                  royalty_fixed_amount: tenant.royalty_fixed_amount,
                  calculated_amount: calculatedAmount,
                  status: 'pending'
                })
                .eq('id', existingInvoice.id);
              if (invoiceUpdateError) {
                throw new Error(`[lockMonth] Failed to update royalty invoice: ${invoiceUpdateError.message}`);
              }
            }
          } else {
            const { error: invoiceInsertError } = await supabase
              .from('franchise_royalty_invoices')
              .insert({
                tenant_id: user.tenant_id,
                invoice_number: invoiceNumber,
                month_year: startDateStr,
                gross_revenue: grossRevenue,
                royalty_type: royaltyType,
                royalty_rate: tenant.royalty_rate,
                royalty_fixed_amount: tenant.royalty_fixed_amount,
                calculated_amount: calculatedAmount,
                status: 'pending'
              });
            if (invoiceInsertError) {
              throw new Error(`[lockMonth] Failed to create royalty invoice: ${invoiceInsertError.message}`);
            }
          }
        }
      }
    } catch (royaltyErr) {
      console.error('[lockMonth] Royalty system error:', royaltyErr);
      throw royaltyErr;
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ─── Inter-branch Redemption Clearing Integration ────────────────────────
    try {
      const startDate = new Date(month);
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth();
      const startDateStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(startYear, startMonth + 1, 0).getDate();
      const endDateStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const { data: sessionLogs, error: sessionErr } = await supabase
        .from('session_logs')
        .select(`
          id,
          tenant_id,
          bookings (
            tenant_id
          )
        `)
        .eq('status', 'completed')
        .gte('completed_date', startDateStr)
        .lte('completed_date', endDateStr);

      if (sessionErr) {
        throw new Error(`[lockMonth] Failed to fetch session logs for clearing: ${sessionErr.message}`);
      } else {
        const interBranchSessions = (sessionLogs || []).filter((s) => {
          const sessionTenantId = s.tenant_id;
          const bookingTenantId = s.bookings?.tenant_id;
          return sessionTenantId && bookingTenantId && sessionTenantId !== bookingTenantId &&
            (sessionTenantId === user.tenant_id || bookingTenantId === user.tenant_id);
        });

        const pairs: Record<string, { debtor_tenant_id: string; creditor_tenant_id: string; session_count: number }> = {};
        for (const session of interBranchSessions) {
          const debtor = session.bookings.tenant_id;
          const creditor = session.tenant_id;
          if (!debtor || !creditor) continue;
          const key = `${debtor}_${creditor}`;
          if (!pairs[key]) {
            pairs[key] = {
              debtor_tenant_id: debtor,
              creditor_tenant_id: creditor,
              session_count: 0
            };
          }
          pairs[key].session_count += 1;
        }

        const allInvolvedTenantIds = Array.from(new Set(
          Object.values(pairs).flatMap(p => [p.debtor_tenant_id, p.creditor_tenant_id])
        ));

        if (allInvolvedTenantIds.length > 0) {
          const { data: tenants, error: tenantsErr } = await supabase
            .from('tenants')
            .select('id, name, internal_clearing_rate')
            .in('id', allInvolvedTenantIds);

          if (tenantsErr) {
            throw new Error(`[lockMonth] Failed to fetch tenants for clearing: ${tenantsErr.message}`);
          } else {
            const tenantMap: Record<string, { name: string; internal_clearing_rate: number }> = {};
            (tenants || []).forEach((t) => {
              tenantMap[t.id] = {
                name: t.name || 'Branch',
                internal_clearing_rate: Number(t.internal_clearing_rate) || 150000.00
              };
            });

            for (const key of Object.keys(pairs)) {
              const pair = pairs[key];
              const debtorName = tenantMap[pair.debtor_tenant_id]?.name || 'DEBTOR';
              const creditorName = tenantMap[pair.creditor_tenant_id]?.name || 'CREDITOR';
              const clearingRate = tenantMap[pair.creditor_tenant_id]?.internal_clearing_rate || 150000.00;
              const calculatedAmount = pair.session_count * clearingRate;

              const debtorAbbr = debtorName.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 5);
              const creditorAbbr = creditorName.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 5);
              const yearMonth = month.substring(0, 7).replace('-', '');
              const randomSuffix = Math.floor(1000 + Math.random() * 9000);
              const clearingNumber = `CLR-${yearMonth}-${debtorAbbr}-${creditorAbbr}-${randomSuffix}`;

              const { data: existingRecord } = await supabase
                .from('inter_branch_clearing_records')
                .select('id, status')
                .eq('month_year', startDateStr)
                .eq('debtor_tenant_id', pair.debtor_tenant_id)
                .eq('creditor_tenant_id', pair.creditor_tenant_id)
                .maybeSingle();

              if (existingRecord) {
                if (existingRecord.status !== 'cleared') {
                  const { error: clearingUpdateError } = await supabase
                    .from('inter_branch_clearing_records')
                    .update({
                      session_count: pair.session_count,
                      clearing_rate: clearingRate,
                      calculated_amount: calculatedAmount,
                      status: 'pending'
                    })
                    .eq('id', existingRecord.id);
                  if (clearingUpdateError) {
                    throw new Error(`[lockMonth] Failed to update inter-branch clearing record: ${clearingUpdateError.message}`);
                  }
                }
              } else {
                const { error: clearingInsertError } = await supabase
                  .from('inter_branch_clearing_records')
                  .insert({
                    clearing_number: clearingNumber,
                    month_year: startDateStr,
                    debtor_tenant_id: pair.debtor_tenant_id,
                    creditor_tenant_id: pair.creditor_tenant_id,
                    session_count: pair.session_count,
                    clearing_rate: clearingRate,
                    calculated_amount: calculatedAmount,
                    status: 'pending'
                  });
                if (clearingInsertError) {
                  throw new Error(`[lockMonth] Failed to create inter-branch clearing record: ${clearingInsertError.message}`);
                }
              }
            }
          }
        }
      }
    } catch (clearingErr) {
      console.error('[lockMonth] Inter-branch clearing error:', clearingErr);
      throw clearingErr;
    }
    // ─────────────────────────────────────────────────────────────────────────

    revalidatePath('/dashboard/finance');
    return { success: true, month };
  } catch (e: unknown) {
    console.error('[lockMonth]', e);
    Sentry.captureException(e);
    return { success: false, error: 'Lỗi hệ thống' };
  }
}
