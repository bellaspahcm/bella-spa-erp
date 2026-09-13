-- Add updated_at trigger for re_customers
-- Matches pattern from other tables

DROP TRIGGER IF EXISTS update_re_customers_updated_at ON public.re_customers;
CREATE TRIGGER update_re_customers_updated_at
  BEFORE UPDATE ON public.re_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
