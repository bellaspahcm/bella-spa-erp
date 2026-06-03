-- Prevent duplicate VietQR webhook revenue rows for the same bank transaction id.
-- New webhook rows store the provider transaction id in revenue.accounting_metadata.
do $$
begin
  if exists (
    select 1
    from public.revenue
    where payment_method = 'VietQR'
      and coalesce(accounting_metadata->>'webhook_transaction_id', '') <> ''
    group by tenant_id, accounting_metadata->>'webhook_transaction_id'
    having count(*) > 1
  ) then
    raise exception 'Duplicate VietQR webhook transaction ids exist in revenue accounting_metadata; resolve them before installing idx_revenue_vietqr_webhook_transaction_unique.';
  end if;
end $$;

create unique index if not exists idx_revenue_vietqr_webhook_transaction_unique
on public.revenue (tenant_id, (accounting_metadata->>'webhook_transaction_id'))
where payment_method = 'VietQR'
  and coalesce(accounting_metadata->>'webhook_transaction_id', '') <> '';
