-- 1. Create accounting_accounts table (Hệ thống tài khoản)
CREATE TABLE IF NOT EXISTS public.accounting_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    account_code TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    parent_id UUID REFERENCES public.accounting_accounts(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, account_code)
);

-- 2. Create accounting_periods table (Kỳ kế toán)
CREATE TABLE IF NOT EXISTS public.accounting_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, name),
    CONSTRAINT valid_date_range CHECK (start_date <= end_date)
);

-- 3. Create journal_entries table (Header Bút toán)
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    reference_type TEXT, -- e.g., 'BOOKING', 'PACKAGE_SALE', 'EXPENSE', 'MANUAL'
    reference_id UUID,   -- ID of the original record
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'POSTED', 'CANCELED')),
    period_id UUID REFERENCES public.accounting_periods(id),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create journal_lines table (Chi tiết Bút toán)
CREATE TABLE IF NOT EXISTS public.journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounting_accounts(id),
    debit_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
    credit_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
    branch_id UUID, -- Optional dimension
    ktv_id UUID,    -- Optional dimension
    cost_center_id UUID, -- Optional dimension
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT positive_amounts CHECK (debit_amount >= 0 AND credit_amount >= 0),
    CONSTRAINT debit_or_credit CHECK ((debit_amount > 0 AND credit_amount = 0) OR (debit_amount = 0 AND credit_amount > 0) OR (debit_amount = 0 AND credit_amount = 0))
);

-- Enable RLS
ALTER TABLE public.accounting_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

-- 5. Create Functions & Triggers

-- Trigger: Prevent modification if Entry is POSTED
CREATE OR REPLACE FUNCTION check_journal_entry_modification()
RETURNS TRIGGER AS $$
DECLARE
    entry_status TEXT;
    entry_period_id UUID;
    period_status TEXT;
BEGIN
    IF TG_TABLE_NAME = 'journal_entries' THEN
        IF OLD.status = 'POSTED' AND NEW.status != 'CANCELED' THEN
            -- Allow status change to CANCELED via reversal, but generally block updates to POSTED entries
            RAISE EXCEPTION 'Cannot modify a POSTED journal entry.';
        END IF;
    ELSIF TG_TABLE_NAME = 'journal_lines' THEN
        SELECT status, period_id INTO entry_status, entry_period_id FROM public.journal_entries WHERE id = OLD.entry_id;
        IF entry_status = 'POSTED' THEN
            RAISE EXCEPTION 'Cannot modify lines of a POSTED journal entry.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_journal_entry_update
BEFORE UPDATE ON public.journal_entries
FOR EACH ROW
EXECUTE FUNCTION check_journal_entry_modification();

CREATE TRIGGER trg_check_journal_line_modify
BEFORE UPDATE OR DELETE ON public.journal_lines
FOR EACH ROW
EXECUTE FUNCTION check_journal_entry_modification();

-- Trigger: Validate Balance when POSTING an entry
CREATE OR REPLACE FUNCTION validate_journal_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
    total_debit DECIMAL(19,4);
    total_credit DECIMAL(19,4);
BEGIN
    IF NEW.status = 'POSTED' AND OLD.status = 'DRAFT' THEN
        SELECT COALESCE(SUM(debit_amount), 0), COALESCE(SUM(credit_amount), 0)
        INTO total_debit, total_credit
        FROM public.journal_lines
        WHERE entry_id = NEW.id;

        IF total_debit != total_credit THEN
            RAISE EXCEPTION 'Journal entry must be balanced to be POSTED. Debit: %, Credit: %', total_debit, total_credit;
        END IF;
        
        IF total_debit = 0 THEN
            RAISE EXCEPTION 'Journal entry must have lines to be POSTED.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_journal_entry_balance
BEFORE UPDATE ON public.journal_entries
FOR EACH ROW
WHEN (NEW.status = 'POSTED' AND OLD.status = 'DRAFT')
EXECUTE FUNCTION validate_journal_entry_balance();

-- Trigger: Set Period automatically if null
CREATE OR REPLACE FUNCTION set_journal_entry_period()
RETURNS TRIGGER AS $$
DECLARE
    active_period_id UUID;
BEGIN
    IF NEW.period_id IS NULL THEN
        SELECT id INTO active_period_id 
        FROM public.accounting_periods 
        WHERE tenant_id = NEW.tenant_id 
          AND status = 'OPEN' 
          AND NEW.entry_date BETWEEN start_date AND end_date
        LIMIT 1;
        
        NEW.period_id := active_period_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_journal_entry_period
BEFORE INSERT OR UPDATE ON public.journal_entries
FOR EACH ROW
EXECUTE FUNCTION set_journal_entry_period();

-- 6. RLS Policies
-- accounting_accounts
CREATE POLICY "Enable read for tenant users" ON public.accounting_accounts FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "Enable all for tenant admins" ON public.accounting_accounts FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()) AND 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- accounting_periods
CREATE POLICY "Enable read for tenant users" ON public.accounting_periods FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "Enable all for tenant admins" ON public.accounting_periods FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()) AND 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- journal_entries
CREATE POLICY "Enable read for tenant users" ON public.journal_entries FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "Enable insert for tenant users" ON public.journal_entries FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "Enable update for tenant admins" ON public.journal_entries FOR UPDATE USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()) AND 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- journal_lines
CREATE POLICY "Enable read for tenant users" ON public.journal_lines FOR SELECT USING (
    entry_id IN (SELECT id FROM public.journal_entries WHERE tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()))
);
CREATE POLICY "Enable insert for tenant users" ON public.journal_lines FOR INSERT WITH CHECK (
    entry_id IN (SELECT id FROM public.journal_entries WHERE tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()))
);
CREATE POLICY "Enable update for tenant admins" ON public.journal_lines FOR UPDATE USING (
    entry_id IN (SELECT id FROM public.journal_entries WHERE tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()) AND 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')))
);
CREATE POLICY "Enable delete for tenant admins" ON public.journal_lines FOR DELETE USING (
    entry_id IN (SELECT id FROM public.journal_entries WHERE tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()) AND 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')))
);
