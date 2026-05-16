-- Migration to add discount_percent to bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS discount_percent NUMERIC DEFAULT 0;

-- Optional: update any existing records with NULL discount to 0
UPDATE bookings SET discount_percent = 0 WHERE discount_percent IS NULL;
