-- ============================================================================
-- Bella Healthcare Platform — Seeding Basic Dental ICD-10 & Inference Rules
-- Migration: 20260806040000_healthcare_seed_data.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.seed_healthcare_data_for_all_tenants()
RETURNS VOID AS $$
DECLARE
    t_record RECORD;
BEGIN
    FOR t_record IN SELECT id FROM public.tenants LOOP
        
        -- 1. Insert Basic Dental ICD-10 Facts
        INSERT INTO public.knowledge_entries (tenant_id, vertical, domain, code, label, description, version, metadata)
        VALUES 
            (t_record.id, 'healthcare', 'icd10', 'K02.9', 'Sâu răng (Dental caries, unspecified)', 'Tổn thương sâu răng phá hủy cấu trúc men răng và ngà răng.', '1.0.0', '{}'),
            (t_record.id, 'healthcare', 'icd10', 'K04.0', 'Viêm tủy răng (Pulpitis)', 'Tình trạng viêm của tủy răng do sâu răng tiến triển hoặc chấn thương.', '1.0.0', '{}'),
            (t_record.id, 'healthcare', 'icd10', 'K05.1', 'Viêm lợi mạn tính (Chronic gingivitis)', 'Viêm nướu răng mạn tính liên quan đến mảng bám vi khuẩn.', '1.0.0', '{}'),
            (t_record.id, 'healthcare', 'icd10', 'K08.1', 'Mất răng (Loss of teeth due to extraction/periodontitis)', 'Mất răng do nhổ, chấn thương hoặc viêm quanh răng mạn tính.', '1.0.0', '{}'),
            (t_record.id, 'healthcare', 'icd10', 'K01.1', 'Răng mọc ngầm (Impacted teeth)', 'Răng mọc ngầm trong xương hàm không thể tự mọc bình thường.', '1.0.0', '{}')
        ON CONFLICT (tenant_id, vertical, domain, code, version) DO UPDATE 
        SET label = EXCLUDED.label, description = EXCLUDED.description;

        -- 2. Insert Basic Drug ATC Code Facts
        INSERT INTO public.knowledge_entries (tenant_id, vertical, domain, code, label, description, version, metadata)
        VALUES 
            (t_record.id, 'healthcare', 'drug_atc', 'J01CA04', 'Amoxicillin', 'Kháng sinh nhóm Penicillin phổ rộng.', '1.0.0', '{"allergy_cross_reactivity": "penicillin"}'),
            (t_record.id, 'healthcare', 'drug_atc', 'J01CR02', 'Amoxicillin and beta-lactamase inhibitor (Augmentin)', 'Kháng sinh nhóm Penicillin kết hợp clavulanate.', '1.0.0', '{"allergy_cross_reactivity": "penicillin"}'),
            (t_record.id, 'healthcare', 'drug_atc', 'M01AE01', 'Ibuprofen', 'Thuốc giảm đau hạ sốt kháng viêm phi steroid (NSAID).', '1.0.0', '{}')
        ON CONFLICT (tenant_id, vertical, domain, code, version) DO UPDATE 
        SET label = EXCLUDED.label, description = EXCLUDED.description;

        -- 3. Insert Basic Drug Contraindication Graph Edge (Relation)
        -- Amoxicillin requires checking for Penicillin allergy.
        INSERT INTO public.knowledge_graph_edges (tenant_id, source_code, source_type, target_code, target_type, relationship_type, strength)
        VALUES
            (t_record.id, 'J01CA04', 'drug_atc', 'penicillin', 'allergy', 'contraindicated_with', 1.00),
            (t_record.id, 'J01CR02', 'drug_atc', 'penicillin', 'allergy', 'contraindicated_with', 1.00)
        ON CONFLICT (tenant_id, source_code, source_type, target_code, target_type, relationship_type) DO NOTHING;

        -- 4. Insert Inference Rules (Drug Contraindication Checking)
        INSERT INTO public.knowledge_inference_rules (tenant_id, vertical, code, name, trigger_type, conditions, action)
        VALUES
            (
                t_record.id, 
                'healthcare', 
                'RULE_PENICILLIN_CONTRAINDICATION', 
                'Chống chỉ định kháng sinh nhóm Penicillin khi dị ứng',
                'if_then',
                '[
                    {"field": "allergies", "operator": "contains", "value": "penicillin"},
                    {"field": "prescribed_drugs", "operator": "contains", "value": "J01CA04"}
                ]'::jsonb,
                '{"type": "block", "payload": {"message": "Bệnh nhân dị ứng với Penicillin. Không kê đơn Amoxicillin!"}}'::jsonb
            )
        ON CONFLICT (tenant_id, vertical, code, version) DO UPDATE 
        SET name = EXCLUDED.name, conditions = EXCLUDED.conditions, action = EXCLUDED.action;

    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute seed function
SELECT public.seed_healthcare_data_for_all_tenants();

-- Clean up helper function
DROP FUNCTION public.seed_healthcare_data_for_all_tenants();
