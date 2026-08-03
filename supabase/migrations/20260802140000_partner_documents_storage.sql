-- Migration: Partner Documents Storage Functions
-- Created: 2026-08-02
-- Purpose: Add RPC functions to manage partner application documents

-- ============================================================================
-- Function: Add document to partner application
-- ============================================================================
CREATE OR REPLACE FUNCTION add_partner_document(
  p_application_id UUID,
  p_file_path TEXT,
  p_file_url TEXT,
  p_category TEXT,
  p_metadata JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_documents JSONB;
  v_new_document JSONB;
BEGIN
  -- Get current documents array
  SELECT documents INTO v_documents
  FROM partner_applications
  WHERE id = p_application_id;
  
  -- Initialize if null
  IF v_documents IS NULL THEN
    v_documents := '[]'::JSONB;
  END IF;
  
  -- Create new document entry
  v_new_document := jsonb_build_object(
    'filePath', p_file_path,
    'fileUrl', p_file_url,
    'category', p_category,
    'metadata', p_metadata,
    'addedAt', NOW()
  );
  
  -- Append to documents array
  v_documents := v_documents || v_new_document;
  
  -- Update application
  UPDATE partner_applications
  SET 
    documents = v_documents,
    updated_at = NOW()
  WHERE id = p_application_id;
  
END;
$$;

-- ============================================================================
-- Function: Remove document from partner application
-- ============================================================================
CREATE OR REPLACE FUNCTION remove_partner_document(
  p_application_id UUID,
  p_file_path TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_documents JSONB;
  v_doc JSONB;
  v_new_documents JSONB;
BEGIN
  -- Get current documents array
  SELECT documents INTO v_documents
  FROM partner_applications
  WHERE id = p_application_id;
  
  IF v_documents IS NULL OR jsonb_array_length(v_documents) = 0 THEN
    RETURN;
  END IF;
  
  -- Filter out the document to remove
  v_new_documents := '[]'::JSONB;
  
  FOR v_doc IN SELECT * FROM jsonb_array_elements(v_documents)
  LOOP
    IF v_doc->>'filePath' != p_file_path THEN
      v_new_documents := v_new_documents || v_doc;
    END IF;
  END LOOP;
  
  -- Update application
  UPDATE partner_applications
  SET 
    documents = v_new_documents,
    updated_at = NOW()
  WHERE id = p_application_id;
  
END;
$$;

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION add_partner_document TO authenticated;
GRANT EXECUTE ON FUNCTION remove_partner_document TO authenticated;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON FUNCTION add_partner_document IS 'Add a document reference to partner application';
COMMENT ON FUNCTION remove_partner_document IS 'Remove a document reference from partner application';
