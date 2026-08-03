-- ============================================================================
-- REAL ESTATE MODULE - RPC FUNCTIONS
-- ============================================================================
-- Version: 1.0.0
-- Date: 2026-08-02
-- Description: Stored procedures and functions for Real Estate operations
-- ============================================================================


-- ============================================================================
-- PRODUCT CATALOG RPCs
-- ============================================================================

-- Get available products for a project
CREATE OR REPLACE FUNCTION get_available_products(
  p_tenant_id UUID,
  p_project_id UUID
)
RETURNS TABLE (
  id UUID,
  product_code TEXT,
  product_type product_type,
  unit_code TEXT,
  area NUMERIC,
  base_price NUMERIC,
  floor_price NUMERIC,
  unit_price NUMERIC,
  block TEXT,
  floor TEXT,
  direction TEXT,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.product_code,
    p.product_type,
    p.unit_code,
    p.area_m2 AS area,
    p.base_price,
    p.floor_price,
    p.unit_price,
    p.block,
    p.floor,
    p.direction,
    p.status
  FROM real_estate_products p
  WHERE p.tenant_id = p_tenant_id
    AND p.project_id = p_project_id
    AND p.status = 'available'
    AND p.deleted_at IS NULL
  ORDER BY p.block, p.floor_number, p.unit_code;
END;
$$;

GRANT EXECUTE ON FUNCTION get_available_products TO authenticated;
COMMENT ON FUNCTION get_available_products IS 'Get available products for a project';

-- ============================================================================
-- RESERVATION RPCs
-- ============================================================================

-- Reserve a product
CREATE OR REPLACE FUNCTION reserve_product(
  p_tenant_id UUID,
  p_product_id UUID,
  p_customer_id UUID,
  p_deposit_amount NUMERIC,
  p_created_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation_id UUID;
  v_product_status TEXT;
BEGIN
  -- Check product availability
  SELECT status INTO v_product_status
  FROM real_estate_products
  WHERE id = p_product_id
    AND tenant_id = p_tenant_id
    AND deleted_at IS NULL
  FOR UPDATE;
  
  IF v_product_status IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
  
  IF v_product_status != 'available' THEN
    RAISE EXCEPTION 'Product is not available for reservation (status: %)', v_product_status;
  END IF;
  
  -- Create reservation
  INSERT INTO re_reservations (
    tenant_id,
    product_id,
    customer_id,
    deposit_amount,
    status,
    created_by
  ) VALUES (
    p_tenant_id,
    p_product_id,
    p_customer_id,
    p_deposit_amount,
    'pending_deposit',
    p_created_by
  )
  RETURNING id INTO v_reservation_id;
  
  -- Update product status
  UPDATE real_estate_products
  SET status = 'reserved', updated_at = NOW(), updated_by = p_created_by
  WHERE id = p_product_id;
  
  RETURN v_reservation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION reserve_product TO authenticated;
COMMENT ON FUNCTION reserve_product IS 'Reserve a product for a customer';

-- Confirm reservation deposit
CREATE OR REPLACE FUNCTION confirm_reservation_deposit(
  p_tenant_id UUID,
  p_reservation_id UUID,
  p_updated_by UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_status reservation_status;
BEGIN
  -- Check current status
  SELECT status INTO v_current_status
  FROM re_reservations
  WHERE id = p_reservation_id
    AND tenant_id = p_tenant_id
    AND deleted_at IS NULL
  FOR UPDATE;
  
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;
  
  IF v_current_status != 'pending_deposit' THEN
    RAISE EXCEPTION 'Cannot confirm deposit for reservation in status: %', v_current_status;
  END IF;
  
  -- Update status
  UPDATE re_reservations
  SET
    status = 'deposited',
    deposited_at = NOW(),
    updated_at = NOW(),
    updated_by = p_updated_by
  WHERE id = p_reservation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_reservation_deposit TO authenticated;
COMMENT ON FUNCTION confirm_reservation_deposit IS 'Confirm deposit received for reservation';

-- Cancel reservation
CREATE OR REPLACE FUNCTION cancel_reservation(
  p_tenant_id UUID,
  p_reservation_id UUID,
  p_reason TEXT,
  p_updated_by UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product_id UUID;
  v_current_status reservation_status;
BEGIN
  -- Get reservation details
  SELECT product_id, status
  INTO v_product_id, v_current_status
  FROM re_reservations
  WHERE id = p_reservation_id
    AND tenant_id = p_tenant_id
    AND deleted_at IS NULL
  FOR UPDATE;
  
  IF v_product_id IS NULL THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;
  
  IF v_current_status = 'converted_to_contract' THEN
    RAISE EXCEPTION 'Cannot cancel reservation that is already converted to contract';
  END IF;
  
  -- Cancel reservation
  UPDATE re_reservations
  SET
    status = 'cancelled',
    cancelled_at = NOW(),
    notes = COALESCE(notes || E'\n', '') || 'Cancelled: ' || p_reason,
    updated_at = NOW(),
    updated_by = p_updated_by
  WHERE id = p_reservation_id;
  
  -- Release product
  UPDATE real_estate_products
  SET status = 'available', updated_at = NOW(), updated_by = p_updated_by
  WHERE id = v_product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_reservation TO authenticated;
COMMENT ON FUNCTION cancel_reservation IS 'Cancel a reservation and release the product';

-- ============================================================================
-- BOOKING RPCs
-- ============================================================================

-- Transition booking state
CREATE OR REPLACE FUNCTION transition_booking_state(
  p_tenant_id UUID,
  p_booking_id UUID,
  p_new_state booking_state,
  p_updated_by UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_state booking_state;
BEGIN
  -- Get current state
  SELECT state INTO v_current_state
  FROM re_bookings
  WHERE id = p_booking_id
    AND tenant_id = p_tenant_id
    AND deleted_at IS NULL
  FOR UPDATE;
  
  IF v_current_state IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;
  
  -- Validate state transitions (from BookingAggregate.transitions)
  IF v_current_state = 'DRAFT' AND p_new_state != 'PENDING_APPROVAL' AND p_new_state != 'CANCELLED' THEN
    RAISE EXCEPTION 'Invalid transition from % to %', v_current_state, p_new_state;
  END IF;
  
  IF v_current_state = 'PENDING_APPROVAL' AND p_new_state != 'CONFIRMED' AND p_new_state != 'CANCELLED' THEN
    RAISE EXCEPTION 'Invalid transition from % to %', v_current_state, p_new_state;
  END IF;
  
  -- Update state
  UPDATE re_bookings
  SET
    state = p_new_state,
    state_changed_at = NOW(),
    updated_at = NOW(),
    updated_by = p_updated_by,
    submitted_at = CASE WHEN p_new_state = 'PENDING_APPROVAL' THEN NOW() ELSE submitted_at END,
    confirmed_at = CASE WHEN p_new_state = 'CONFIRMED' THEN NOW() ELSE confirmed_at END,
    cancelled_at = CASE WHEN p_new_state = 'CANCELLED' THEN NOW() ELSE cancelled_at END
  WHERE id = p_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION transition_booking_state TO authenticated;
COMMENT ON FUNCTION transition_booking_state IS 'Transition booking state with FSM validation';

-- ============================================================================
-- CONTRACT RPCs
-- ============================================================================

-- Transition contract state
CREATE OR REPLACE FUNCTION transition_contract_state(
  p_tenant_id UUID,
  p_contract_id UUID,
  p_new_state contract_state,
  p_updated_by UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_state contract_state;
BEGIN
  -- Get current state
  SELECT state INTO v_current_state
  FROM re_contracts
  WHERE id = p_contract_id
    AND tenant_id = p_tenant_id
    AND deleted_at IS NULL
  FOR UPDATE;
  
  IF v_current_state IS NULL THEN
    RAISE EXCEPTION 'Contract not found';
  END IF;
  
  -- Validate state transitions (from ContractAggregate.transitions)
  IF v_current_state = 'DRAFT' AND p_new_state != 'PENDING_APPROVAL' AND p_new_state != 'TERMINATED' THEN
    RAISE EXCEPTION 'Invalid transition from % to %', v_current_state, p_new_state;
  END IF;
  
  IF v_current_state = 'PENDING_APPROVAL' AND p_new_state != 'ACTIVE' AND p_new_state != 'TERMINATED' THEN
    RAISE EXCEPTION 'Invalid transition from % to %', v_current_state, p_new_state;
  END IF;
  
  -- Update state
  UPDATE re_contracts
  SET
    state = p_new_state,
    state_changed_at = NOW(),
    updated_at = NOW(),
    updated_by = p_updated_by,
    submitted_at = CASE WHEN p_new_state = 'PENDING_APPROVAL' THEN NOW() ELSE submitted_at END,
    activated_at = CASE WHEN p_new_state = 'ACTIVE' THEN NOW() ELSE activated_at END,
    terminated_at = CASE WHEN p_new_state = 'TERMINATED' THEN NOW() ELSE terminated_at END
  WHERE id = p_contract_id;
  
  -- Update product status when contract activated
  IF p_new_state = 'ACTIVE' THEN
    UPDATE real_estate_products p
    SET status = 'sold', updated_at = NOW(), updated_by = p_updated_by
    FROM re_contracts c
    WHERE c.id = p_contract_id AND c.product_id = p.id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION transition_contract_state TO authenticated;
COMMENT ON FUNCTION transition_contract_state IS 'Transition contract state with FSM validation';

-- Generate contract installment schedule
CREATE OR REPLACE FUNCTION generate_contract_installments(
  p_tenant_id UUID,
  p_contract_id UUID,
  p_installments_count INTEGER,
  p_start_date DATE,
  p_updated_by UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contract_price NUMERIC;
  v_installment_amount NUMERIC;
  v_remaining_amount NUMERIC;
  v_installments JSONB;
  v_installment JSONB;
  v_due_date DATE;
  i INTEGER;
BEGIN
  -- Get contract price
  SELECT contract_price INTO v_contract_price
  FROM re_contracts
  WHERE id = p_contract_id
    AND tenant_id = p_tenant_id
    AND deleted_at IS NULL
  FOR UPDATE;
  
  IF v_contract_price IS NULL THEN
    RAISE EXCEPTION 'Contract not found';
  END IF;
  
  IF p_installments_count <= 0 THEN
    RAISE EXCEPTION 'Installments count must be greater than zero';
  END IF;
  
  -- Calculate installments
  v_installment_amount := FLOOR(v_contract_price / p_installments_count);
  v_remaining_amount := v_contract_price;
  v_installments := '[]'::JSONB;
  
  FOR i IN 1..p_installments_count LOOP
    v_due_date := p_start_date + ((i - 1) || ' months')::INTERVAL;
    
    -- Last installment gets remaining amount
    IF i = p_installments_count THEN
      v_installment_amount := v_remaining_amount;
    END IF;
    
    v_installment := jsonb_build_object(
      'installmentNumber', i,
      'dueDate', v_due_date,
      'percentage', ROUND(100.0 / p_installments_count, 2),
      'amount', v_installment_amount,
      'milestoneLabel', 'Đợt ' || i || ' - Thanh toán định kỳ tháng ' || i
    );
    
    v_installments := v_installments || v_installment;
    v_remaining_amount := v_remaining_amount - v_installment_amount;
  END LOOP;
  
  -- Update contract
  UPDATE re_contracts
  SET
    installments = v_installments,
    updated_at = NOW(),
    updated_by = p_updated_by
  WHERE id = p_contract_id;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_contract_installments TO authenticated;
COMMENT ON FUNCTION generate_contract_installments IS 'Generate installment schedule for contract (from ContractAggregate.generatePaymentSchedule)';

-- ============================================================================
-- LEAD RPCs
-- ============================================================================

-- Transition lead state
CREATE OR REPLACE FUNCTION transition_lead_state(
  p_tenant_id UUID,
  p_lead_id UUID,
  p_new_state lead_state,
  p_assigned_to UUID,
  p_lost_reason TEXT,
  p_updated_by UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_state lead_state;
BEGIN
  -- Get current state
  SELECT state INTO v_current_state
  FROM re_leads
  WHERE id = p_lead_id
    AND tenant_id = p_tenant_id
    AND deleted_at IS NULL
  FOR UPDATE;
  
  IF v_current_state IS NULL THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;
  
  -- Validate state transitions (from LeadAggregate.transitions)
  -- NEW → ASSIGNED
  IF v_current_state = 'NEW' AND p_new_state NOT IN ('ASSIGNED', 'LOST') THEN
    RAISE EXCEPTION 'Invalid transition from % to %', v_current_state, p_new_state;
  END IF;
  
  -- ASSIGNED → CONTACTED
  IF v_current_state = 'ASSIGNED' AND p_new_state NOT IN ('CONTACTED', 'LOST') THEN
    RAISE EXCEPTION 'Invalid transition from % to %', v_current_state, p_new_state;
  END IF;
  
  -- CONTACTED → QUALIFIED
  IF v_current_state = 'CONTACTED' AND p_new_state NOT IN ('QUALIFIED', 'LOST') THEN
    RAISE EXCEPTION 'Invalid transition from % to %', v_current_state, p_new_state;
  END IF;
  
  -- QUALIFIED → VISIT_SCHEDULED
  IF v_current_state = 'QUALIFIED' AND p_new_state NOT IN ('VISIT_SCHEDULED', 'LOST') THEN
    RAISE EXCEPTION 'Invalid transition from % to %', v_current_state, p_new_state;
  END IF;
  
  -- VISIT_SCHEDULED → NEGOTIATING
  IF v_current_state = 'VISIT_SCHEDULED' AND p_new_state NOT IN ('NEGOTIATING', 'LOST') THEN
    RAISE EXCEPTION 'Invalid transition from % to %', v_current_state, p_new_state;
  END IF;
  
  -- NEGOTIATING → CONVERTED
  IF v_current_state = 'NEGOTIATING' AND p_new_state NOT IN ('CONVERTED', 'LOST') THEN
    RAISE EXCEPTION 'Invalid transition from % to %', v_current_state, p_new_state;
  END IF;
  
  -- Update state
  UPDATE re_leads
  SET
    state = p_new_state,
    state_changed_at = NOW(),
    updated_at = NOW(),
    updated_by = p_updated_by,
    assigned_to = CASE WHEN p_new_state = 'ASSIGNED' THEN p_assigned_to ELSE assigned_to END,
    lost_reason = CASE WHEN p_new_state = 'LOST' THEN p_lost_reason ELSE lost_reason END
  WHERE id = p_lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION transition_lead_state TO authenticated;
COMMENT ON FUNCTION transition_lead_state IS 'Transition lead state with FSM validation (from LeadAggregate)';

-- ============================================================================
-- DASHBOARD / REPORTING RPCs
-- ============================================================================

-- Get sales dashboard stats
CREATE OR REPLACE FUNCTION get_sales_dashboard_stats(
  p_tenant_id UUID,
  p_project_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_products BIGINT,
  available_products BIGINT,
  reserved_products BIGINT,
  sold_products BIGINT,
  total_bookings BIGINT,
  confirmed_bookings BIGINT,
  active_contracts BIGINT,
  total_revenue NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH product_stats AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'available') AS available,
      COUNT(*) FILTER (WHERE status = 'reserved') AS reserved,
      COUNT(*) FILTER (WHERE status = 'sold') AS sold
    FROM real_estate_products
    WHERE tenant_id = p_tenant_id
      AND (p_project_id IS NULL OR project_id = p_project_id)
      AND deleted_at IS NULL
  ),
  booking_stats AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE state = 'CONFIRMED') AS confirmed
    FROM re_bookings
    WHERE tenant_id = p_tenant_id
      AND deleted_at IS NULL
  ),
  contract_stats AS (
    SELECT
      COUNT(*) AS active,
      COALESCE(SUM(contract_price), 0) AS revenue
    FROM re_contracts
    WHERE tenant_id = p_tenant_id
      AND state = 'ACTIVE'
      AND deleted_at IS NULL
  )
  SELECT
    ps.total,
    ps.available,
    ps.reserved,
    ps.sold,
    bs.total,
    bs.confirmed,
    cs.active,
    cs.revenue
  FROM product_stats ps, booking_stats bs, contract_stats cs;
END;
$$;

GRANT EXECUTE ON FUNCTION get_sales_dashboard_stats TO authenticated;
COMMENT ON FUNCTION get_sales_dashboard_stats IS 'Get aggregated sales dashboard statistics';


DO $$
DECLARE
  v_function_count INT;
BEGIN
  SELECT COUNT(*) INTO v_function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'get_available_products',
      'reserve_product',
      'confirm_reservation_deposit',
      'cancel_reservation',
      'transition_booking_state',
      'transition_contract_state',
      'generate_contract_installments',
      'transition_lead_state',
      'get_sales_dashboard_stats'
    );
  
  RAISE NOTICE '✅ Real Estate RPC functions created: %', v_function_count;
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ REAL ESTATE RPC FUNCTIONS DEPLOYED SUCCESSFULLY';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE 'Functions: %', v_function_count;
  RAISE NOTICE '';
END $$;
