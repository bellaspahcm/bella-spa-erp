-- Migration: 20260909000059_p73_finance_rls_grant.sql
-- Description: Grant table access and update RLS policies for edu_fin_* tables

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

DROP POLICY IF EXISTS tenant_isolation_edu_fin_fee_structures ON public.edu_fin_fee_structures;
DROP POLICY IF EXISTS tenant_isolation_edu_fin_billing_periods ON public.edu_fin_billing_periods;
DROP POLICY IF EXISTS tenant_isolation_edu_fin_student_discount_profiles ON public.edu_fin_student_discount_profiles;
DROP POLICY IF EXISTS tenant_isolation_edu_fin_invoices ON public.edu_fin_invoices;
DROP POLICY IF EXISTS tenant_isolation_edu_fin_invoice_line_items ON public.edu_fin_invoice_line_items;
DROP POLICY IF EXISTS tenant_isolation_edu_fin_payments ON public.edu_fin_payments;
DROP POLICY IF EXISTS tenant_isolation_edu_fin_reconciliation_ledger ON public.edu_fin_reconciliation_ledger;
DROP POLICY IF EXISTS tenant_isolation_edu_fin_receipts ON public.edu_fin_receipts;

CREATE POLICY tenant_isolation_edu_fin_fee_structures ON public.edu_fin_fee_structures FOR ALL USING (true);
CREATE POLICY tenant_isolation_edu_fin_billing_periods ON public.edu_fin_billing_periods FOR ALL USING (true);
CREATE POLICY tenant_isolation_edu_fin_student_discount_profiles ON public.edu_fin_student_discount_profiles FOR ALL USING (true);
CREATE POLICY tenant_isolation_edu_fin_invoices ON public.edu_fin_invoices FOR ALL USING (true);
CREATE POLICY tenant_isolation_edu_fin_invoice_line_items ON public.edu_fin_invoice_line_items FOR ALL USING (true);
CREATE POLICY tenant_isolation_edu_fin_payments ON public.edu_fin_payments FOR ALL USING (true);
CREATE POLICY tenant_isolation_edu_fin_reconciliation_ledger ON public.edu_fin_reconciliation_ledger FOR ALL USING (true);
CREATE POLICY tenant_isolation_edu_fin_receipts ON public.edu_fin_receipts FOR ALL USING (true);
