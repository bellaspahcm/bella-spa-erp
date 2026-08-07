-- Attach audit triggers to healthcare and dental tables

-- 1. Healthcare Appointments
DROP TRIGGER IF EXISTS audit_hc_appointments_changes ON public.hc_appointments;
CREATE TRIGGER audit_hc_appointments_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.hc_appointments
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 2. Healthcare Encounters
DROP TRIGGER IF EXISTS audit_hc_encounters_changes ON public.hc_encounters;
CREATE TRIGGER audit_hc_encounters_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.hc_encounters
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 3. Healthcare Prescriptions
DROP TRIGGER IF EXISTS audit_hc_prescriptions_changes ON public.hc_prescriptions;
CREATE TRIGGER audit_hc_prescriptions_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.hc_prescriptions
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 4. Healthcare Clinical Orders
DROP TRIGGER IF EXISTS audit_hc_clinical_orders_changes ON public.hc_clinical_orders;
CREATE TRIGGER audit_hc_clinical_orders_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.hc_clinical_orders
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 5. Healthcare Lab Orders (LIS)
DROP TRIGGER IF EXISTS audit_hc_lab_orders_changes ON public.hc_lab_orders;
CREATE TRIGGER audit_hc_lab_orders_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.hc_lab_orders
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 6. Healthcare Imaging Orders (RIS)
DROP TRIGGER IF EXISTS audit_hc_imaging_orders_changes ON public.hc_imaging_orders;
CREATE TRIGGER audit_hc_imaging_orders_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.hc_imaging_orders
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 7. Patient Profiles
DROP TRIGGER IF EXISTS audit_patient_profiles_changes ON public.patient_profiles;
CREATE TRIGGER audit_patient_profiles_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.patient_profiles
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 8. Drug Profiles
DROP TRIGGER IF EXISTS audit_hc_drug_profiles_changes ON public.hc_drug_profiles;
CREATE TRIGGER audit_hc_drug_profiles_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.hc_drug_profiles
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 9. Patient Journey Queue
DROP TRIGGER IF EXISTS audit_hc_patient_queues_changes ON public.hc_patient_queues;
CREATE TRIGGER audit_hc_patient_queues_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.hc_patient_queues
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 10. Dental Odontograms
DROP TRIGGER IF EXISTS audit_den_odontograms_changes ON public.den_odontograms;
CREATE TRIGGER audit_den_odontograms_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.den_odontograms
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
