-- Add branch-count quota as a first-class subscription entitlement.
-- This keeps package management ready for Beauty Spa customers that buy
-- a main spa plus additional branches, without changing tenant isolation.

INSERT INTO public.subscription_plan_entitlements (
    plan_code,
    feature_key,
    limit_value,
    is_unlimited,
    unit,
    enforcement_mode,
    reset_period,
    description
) VALUES
    ('free_trial', 'branch', 1, FALSE, 'count', 'hard', 'none', 'Maximum active branches/locations.'),
    ('basic', 'branch', 1, FALSE, 'count', 'hard', 'none', 'Maximum active branches/locations.'),
    ('pro', 'branch', 3, FALSE, 'count', 'hard', 'none', 'Maximum active branches/locations.'),
    ('enterprise', 'branch', NULL, TRUE, 'count', 'hard', 'none', 'Unlimited branches/locations.')
ON CONFLICT (plan_code, feature_key) DO UPDATE SET
    limit_value = EXCLUDED.limit_value,
    is_unlimited = EXCLUDED.is_unlimited,
    unit = EXCLUDED.unit,
    enforcement_mode = EXCLUDED.enforcement_mode,
    reset_period = EXCLUDED.reset_period,
    description = EXCLUDED.description,
    updated_at = NOW();
