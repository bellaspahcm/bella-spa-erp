-- Fix foreign key constraint for membership_records to cascade delete when customer is deleted
ALTER TABLE public.membership_records
DROP CONSTRAINT IF EXISTS membership_records_customer_id_fkey,
ADD CONSTRAINT membership_records_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE CASCADE;
