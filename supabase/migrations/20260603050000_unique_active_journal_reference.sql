-- Prevent duplicate active journals for worker-generated business references.
-- If existing duplicates are present, stop the migration so accounting can reconcile them explicitly.
do $$
begin
  if exists (
    select 1
    from public.journal_entries
    where reference_id is not null
      and reference_type in (
        'PACKAGE_SALE',
        'SESSION_DONE',
        'EXPENSE',
        'SALARY_PAYMENT',
        'INVENTORY_CONSUMPTION',
        'REFUND',
        'MANUAL'
      )
      and status <> 'CANCELED'
    group by tenant_id, reference_type, reference_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate active journal references exist; resolve them before installing idx_journal_entries_worker_reference_unique.';
  end if;
end $$;

create unique index if not exists idx_journal_entries_worker_reference_unique
on public.journal_entries (tenant_id, reference_type, reference_id)
where reference_id is not null
  and reference_type in (
    'PACKAGE_SALE',
    'SESSION_DONE',
    'EXPENSE',
    'SALARY_PAYMENT',
    'INVENTORY_CONSUMPTION',
    'REFUND',
    'MANUAL'
  )
  and status <> 'CANCELED';
