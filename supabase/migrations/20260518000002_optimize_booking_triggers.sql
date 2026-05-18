-- Optimize fn_sync_booking_progress to only run updates when a session transitions to/from completed
CREATE OR REPLACE FUNCTION fn_sync_booking_progress()
RETURNS TRIGGER AS $$
DECLARE
    v_booking_id UUID;
BEGIN
    v_booking_id := COALESCE(NEW.booking_id, OLD.booking_id);

    -- Only run the update if the status changed to/from 'completed', or if it's a delete of a completed session, or insert of a completed session
    IF (TG_OP = 'INSERT' AND NEW.status = 'completed') OR
       (TG_OP = 'DELETE' AND OLD.status = 'completed') OR
       (TG_OP = 'UPDATE' AND (OLD.status = 'completed' OR NEW.status = 'completed') AND OLD.status IS DISTINCT FROM NEW.status) THEN
        
        UPDATE bookings
        SET completed_sessions = (
            SELECT COUNT(*) 
            FROM session_logs 
            WHERE booking_id = v_booking_id
            AND status = 'completed'
        ),
        updated_at = NOW()
        WHERE id = v_booking_id;
        
    END IF;
    
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Optimize fn_sync_booking_finance to only run updates when revenue transitions to/from confirmed
CREATE OR REPLACE FUNCTION fn_sync_booking_finance()
RETURNS TRIGGER AS $$
DECLARE
    v_booking_id UUID;
BEGIN
    v_booking_id := COALESCE(NEW.booking_id, OLD.booking_id);

    -- Only run the update if the status changed to/from 'confirmed', or if it's a delete/insert of a confirmed revenue transaction
    IF (TG_OP = 'INSERT' AND NEW.status = 'confirmed') OR
       (TG_OP = 'DELETE' AND OLD.status = 'confirmed') OR
       (TG_OP = 'UPDATE' AND (OLD.status = 'confirmed' OR NEW.status = 'confirmed') AND OLD.status IS DISTINCT FROM NEW.status) THEN

        UPDATE bookings
        SET deposit_amount = (
            SELECT COALESCE(SUM(amount), 0)
            FROM revenue
            WHERE booking_id = v_booking_id
            AND status = 'confirmed'
        ),
        updated_at = NOW()
        WHERE id = v_booking_id;

    END IF;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;
