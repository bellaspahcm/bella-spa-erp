/**
 * Migration: Add product_usage field to packages table
 * 
 * **Purpose**: Enable inventory forecasting based on booking packages.
 * 
 * **Business Logic:**
 * - Each package defines products used per session
 * - Format: { "product-id": quantity_per_session }
 * - Example: { "dau-massage-uuid": 2, "khan-tam-uuid": 1 }
 * - Used to calculate projected inventory usage
 * 
 * **Feature**: Booking-based inventory forecast (Task #8)
 */

-- Add product_usage column to packages table
ALTER TABLE packages 
ADD COLUMN IF NOT EXISTS product_usage JSONB DEFAULT '{}'::jsonb;

-- Add comment
COMMENT ON COLUMN packages.product_usage IS 'Product usage per session. Format: {"product_id": quantity}. Used for inventory forecasting.';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_packages_product_usage 
ON packages USING GIN (product_usage);

-- Example usage comment
COMMENT ON TABLE packages IS 'Service packages with product usage tracking. product_usage example: {"uuid-dau-massage": 2, "uuid-khan": 1} means each session uses 2 bottles of oil and 1 towel.';
