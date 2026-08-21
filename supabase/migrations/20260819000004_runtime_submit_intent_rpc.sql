-- Migration 04 v1.1: Runtime Submit Financial Intent RPC
-- Date: 2026-08-19
-- Architecture: BELLA_RUNTIME_TRANSACTION_ARCHITECTURE_DECISION_V1_1_CORRECTED.md
-- Status: FROZEN FOR VALIDATION
-- Security: Tenant/actor server-derived, SECURITY DEFINER with explicit validation

-- Drop existing function if any
DROP FUNCTION IF EXISTS public.submit_financial_intent(TEXT, TEXT, JSONB);

-- Create RPC function
CREATE OR REPLACE FUNCTION public.submit_financial_intent(
    p_idempotency_key TEXT,
    p_intent_type TEXT,
    p_intent_payload JSONB
) RETURNS UUID AS $$
DECLARE
    v_outbox_id UUID;
    v_tenant_id UUID;
    v_actor_id UUID;
BEGIN
    -- Security: Derive tenant and actor from authenticated context (no client control)
    v_tenant_id := public.get_auth_tenant_id();
    v_actor_id := auth.uid();
    
    -- Explicit validation: Tenant isolation
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No authenticated tenant context';
    END IF;
    
    -- Explicit validation: Actor authentication
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'No authenticated user context';
    END IF;
    
    -- Explicit validation: Idempotency key required
    IF p_idempotency_key IS NULL OR p_idempotency_key = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;
    
    -- Generate outbox ID
    v_outbox_id := gen_random_uuid();
    
    -- TB-1: Atomic persistence (3 INSERTs in statement-level transaction)
    -- INSERT 1: Outbox
    INSERT INTO public.runtime_outbox (
        outbox_id,
        tenant_id,
        intent_type,
        intent_payload,
        status,
        created_at
    ) VALUES (
        v_outbox_id,
        v_tenant_id,
        p_intent_type,
        p_intent_payload,
        'PENDING',
        now()
    );
    
    -- INSERT 2: Idempotency registry (TB-2: UNIQUE constraint is authority)
    INSERT INTO public.runtime_idempotency_registry (
        tenant_id,
        idempotency_key,
        outbox_id,
        created_by,
        created_at
    ) VALUES (
        v_tenant_id,
        p_idempotency_key,
        v_outbox_id,
        v_actor_id,
        now()
    );
    
    -- INSERT 3: Audit log
    INSERT INTO public.runtime_audit_log (
        outbox_id,
        action,
        tenant_id,
        actor_id,
        metadata,
        created_at
    ) VALUES (
        v_outbox_id,
        'INTENT_SUBMITTED',
        v_tenant_id,
        v_actor_id,
        jsonb_build_object(
            'intent_type', p_intent_type,
            'idempotency_key', p_idempotency_key
        ),
        now()
    );
    
    -- Return outbox ID
    RETURN v_outbox_id;
    
EXCEPTION
    -- TB-2: Idempotency violation (UNIQUE constraint)
    WHEN unique_violation THEN
        RAISE;  -- Let client handle duplicate (23505)
    
    -- Other errors: Rollback all 3 INSERTs (TB-1 atomic)
    WHEN OTHERS THEN
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Security: Revoke from anon, grant to authenticated
REVOKE EXECUTE ON FUNCTION public.submit_financial_intent(TEXT, TEXT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_financial_intent(TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_financial_intent(TEXT, TEXT, JSONB) TO authenticated;

-- Notify completion
NOTIFY pgrst, 'reload schema';
