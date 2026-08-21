/**
 * E3 REWORK - R3: Fix Accessorial Validation Schema Gap
 * 
 * ISSUE: line_items.charge_type only allows generic 'accessorial',
 * but validation needs to match against specific types ('detention', 'layover', etc.)
 * stored in accessorial_rates.charge_type
 * 
 * SOLUTION: Add accessorial_subtype column to store specific type
 * when charge_type='accessorial'
 * 
 * Category: Rework (fixing implementation/schema mismatch)
 */

-- Add accessorial_subtype column
ALTER TABLE log_invoice_line_items 
ADD COLUMN IF NOT EXISTS accessorial_subtype VARCHAR(50);

-- Backfill existing accessorial rows (set to 'other' as default)
UPDATE log_invoice_line_items
SET accessorial_subtype = 'other'
WHERE charge_type = 'accessorial' AND accessorial_subtype IS NULL;

-- Add constraint to ensure subtype is set when charge_type='accessorial'
ALTER TABLE log_invoice_line_items
ADD CONSTRAINT log_invoice_line_items_accessorial_subtype_check
CHECK (
  (charge_type = 'accessorial' AND accessorial_subtype IS NOT NULL) OR
  (charge_type != 'accessorial' AND accessorial_subtype IS NULL)
);

-- Add index for accessorial lookups
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_accessorial_subtype 
ON log_invoice_line_items(tenant_id, accessorial_subtype) 
WHERE charge_type = 'accessorial';

COMMENT ON COLUMN log_invoice_line_items.accessorial_subtype IS 
'Specific accessorial type (detention, layover, etc.) when charge_type=accessorial. Required for validation against accessorial_rates.';
