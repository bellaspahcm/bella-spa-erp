# Bella ERP Mobile App — Phase 3 Tuần 9: Customer CRM & Camera Integration
## Phiên bản v1.0

**Ngày tạo:** 2026-06-22
**Phase:** 3 — Customer Intelligence & Media
**Tiền điều kiện:** Phase 2 (Tuần 8) DoD hoàn thành — Leaderboard 2.0, Achievement event-driven, Renewal approval flow.

---

## Tổng Quan & Mục Tiêu

Tuần 9 mở ra **lớp Customer Intelligence** — KTV và Admin có thể nhìn thấy lịch sử đầy đủ của khách hàng, ghi chú dài hạn, và đính kèm ảnh trước/sau dịch vụ trực tiếp từ mobile.

```
KTV hoàn thành buổi
  ↓
Chụp ảnh trước/sau (Camera → Supabase Storage)
Ghi chú chi tiết (rich text + ảnh đính kèm)
  ↓
Admin/KTV xem Customer Profile
  ↓
Lịch sử đầy đủ: sessions, reviews, packages, notes, photos
  ↓
Insight: khách thường dùng gói nào, rating trung bình, lần tới nên gợi ý gì
```

**3 mảng chính:**

1. **Camera & Media Upload:**
   - Chụp ảnh trước/sau buổi dịch vụ → upload Supabase Storage
   - Ảnh liên kết với `session_logs.id` + `customer_id`
   - Gallery xem lại ảnh theo session
   - Giới hạn file size + resize trước upload (tránh tốn storage)

2. **Customer Profile Deep View:**
   - Màn hình profile khách: thông tin cơ bản + timeline toàn bộ lịch sử
   - Package history: gói nào đã dùng, còn bao nhiêu buổi
   - Review history: khách đánh giá như thế nào từng lần
   - KTV note timeline: ghi chú từ các KTV phụ trách

3. **KTV Long-Term Notes (Chăm sóc khách):**
   - Note loại "chăm sóc": dị ứng, sở thích, lưu ý đặc biệt
   - Note gắn với khách (không phải session) — tồn tại lâu dài
   - Phân quyền: KTV ghi, Admin đọc toàn bộ tenant

---

## 1. Supabase Backend — Media Storage & RPCs

### [NEW] `20260809000000_session_media.sql`

```sql
-- supabase/migrations/20260809000000_session_media.sql
-- ============================================================
-- Bảng lưu metadata ảnh đính kèm session
-- File thực tế lưu trong Supabase Storage bucket: 'session-media'
-- ============================================================

CREATE TABLE IF NOT EXISTS public.session_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    session_log_id UUID NOT NULL REFERENCES public.session_logs(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES public.users(id),

    -- Storage path: {tenant_id}/{customer_id}/{session_log_id}/{filename}
    storage_path TEXT NOT NULL,
    storage_bucket TEXT NOT NULL DEFAULT 'session-media',

    -- Metadata
    media_type TEXT NOT NULL DEFAULT 'photo',
    -- media_type: 'before_photo' | 'after_photo' | 'reference_photo' | 'note_attachment'
    caption TEXT,              -- Chú thích của KTV
    file_size_bytes INTEGER,   -- Để track storage usage
    width INTEGER,
    height INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Không upload quá 10 ảnh/session để tránh storage abuse
    CONSTRAINT max_media_per_type CHECK (media_type IN (
        'before_photo', 'after_photo', 'reference_photo', 'note_attachment'
    ))
);

ALTER TABLE public.session_media ENABLE ROW LEVEL SECURITY;

-- KTV upload/xem media của buổi họ phụ trách; Admin xem toàn tenant
CREATE POLICY "session_media_access" ON public.session_media
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM public.users WHERE id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_session_media_session
    ON public.session_media(session_log_id, media_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_media_customer
    ON public.session_media(customer_id, tenant_id, created_at DESC);


-- ============================================================
-- Bảng ghi chú dài hạn về khách (không gắn với session cụ thể)
-- Phân biệt với session notes: đây là "hồ sơ khách hàng"
-- ============================================================

CREATE TABLE IF NOT EXISTS public.customer_care_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    written_by UUID NOT NULL REFERENCES public.users(id),

    note_type TEXT NOT NULL DEFAULT 'general',
    -- note_type: 'allergy' | 'preference' | 'warning' | 'general' | 'recommendation'
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,   -- Pin note quan trọng lên đầu
    is_visible_to_all_ktv BOOLEAN DEFAULT TRUE,  -- FALSE = chỉ admin/hr thấy

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT note_type_check CHECK (note_type IN (
        'allergy', 'preference', 'warning', 'general', 'recommendation'
    ))
);

ALTER TABLE public.customer_care_notes ENABLE ROW LEVEL SECURITY;

-- KTV thấy note visible_to_all_ktv; Admin thấy tất cả
CREATE POLICY "customer_care_notes_access" ON public.customer_care_notes
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())
        AND (
            is_visible_to_all_ktv = TRUE
            OR EXISTS (
                SELECT 1 FROM public.users u
                WHERE u.id = auth.uid()
                  AND u.role IN ('admin', 'super_admin', 'hr')
                  AND u.tenant_id = customer_care_notes.tenant_id
            )
        )
    );

-- KTV chỉ sửa note của mình; Admin sửa tất cả
CREATE POLICY "customer_care_notes_write" ON public.customer_care_notes
    FOR INSERT WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    );

CREATE POLICY "customer_care_notes_update" ON public.customer_care_notes
    FOR UPDATE USING (
        written_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
              AND u.role IN ('admin', 'super_admin')
              AND u.tenant_id = customer_care_notes.tenant_id
        )
    );

CREATE INDEX IF NOT EXISTS idx_customer_care_notes_customer
    ON public.customer_care_notes(customer_id, tenant_id, is_pinned DESC, created_at DESC);


-- ============================================================
-- Storage bucket policy (chạy qua Supabase Dashboard hoặc CLI)
-- ============================================================
-- Tạo bucket: session-media (private, max 5MB/file)
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'session-media', 'session-media', false, 5242880,
--   ARRAY['image/jpeg', 'image/png', 'image/webp']
-- );
```

### [NEW] `20260809000001_customer_profile_rpcs.sql`

```sql
-- supabase/migrations/20260809000001_customer_profile_rpcs.sql

-- ============================================================
-- RPC 1: Lấy Customer Profile đầy đủ (cho mobile)
-- Bao gồm: info, packages, sessions gần đây, reviews, care notes
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_mobile_get_customer_profile(
    p_customer_id UUID,
    p_sessions_limit INTEGER DEFAULT 10
)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_tenant_id UUID;
    v_result JSONB;
BEGIN
    SELECT tenant_id INTO v_tenant_id
    FROM public.users WHERE id = v_caller_id;

    IF v_tenant_id IS NULL THEN
        RETURN jsonb_build_object('error', 'AUTH_ERROR');
    END IF;

    -- Verify customer thuộc tenant này
    IF NOT EXISTS (
        SELECT 1 FROM public.customers
        WHERE id = p_customer_id AND tenant_id = v_tenant_id
    ) THEN
        RETURN jsonb_build_object('error', 'CUSTOMER_NOT_FOUND');
    END IF;

    SELECT jsonb_build_object(

        -- ── Thông tin cơ bản ──
        'customer', (
            SELECT jsonb_build_object(
                'id', c.id,
                'full_name', c.full_name,
                'phone', c.phone,
                'email', c.email,
                'avatar_url', c.avatar_url,
                'created_at', c.created_at,
                'total_bookings', (
                    SELECT COUNT(*) FROM public.bookings
                    WHERE customer_id = c.id AND tenant_id = v_tenant_id
                ),
                'total_completed_sessions', (
                    SELECT COUNT(*) FROM public.session_logs sl
                    JOIN public.bookings b ON sl.booking_id = b.id
                    WHERE b.customer_id = c.id
                      AND b.tenant_id = v_tenant_id
                      AND sl.status = 'completed'
                ),
                'avg_review_given', (
                    -- Rating trung bình mà khách NÀY cho
                    SELECT ROUND(AVG(sr.rating)::NUMERIC, 2)
                    FROM public.session_reviews sr
                    JOIN public.session_logs sl ON sr.session_log_id = sl.id
                    JOIN public.bookings b ON sl.booking_id = b.id
                    WHERE b.customer_id = c.id
                      AND b.tenant_id = v_tenant_id
                      AND sr.status = 'approved'
                )
            )
            FROM public.customers c
            WHERE c.id = p_customer_id
        ),

        -- ── Package timeline ──
        'packages', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'booking_id', b.id,
                    'booking_number', b.booking_number,
                    'package_name', b.package_name,
                    'status', b.status,
                    'total_sessions', b.total_sessions,
                    'completed_sessions', (
                        SELECT COUNT(*) FROM public.session_logs sl2
                        WHERE sl2.booking_id = b.id
                          AND sl2.status = 'completed'
                          AND sl2.tenant_id = v_tenant_id
                    ),
                    'assigned_ktv_name', (
                        SELECT u.full_name FROM public.users u WHERE u.id = b.assigned_ktv_id
                    ),
                    'started_at', b.created_at,
                    'source', b.source  -- 'new' | 'renewal'
                ) ORDER BY b.created_at DESC
            ), '[]'::jsonb)
            FROM public.bookings b
            WHERE b.customer_id = p_customer_id
              AND b.tenant_id = v_tenant_id
        ),

        -- ── Sessions gần đây ──
        'recent_sessions', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'session_id', sl.id,
                    'completed_date', sl.completed_date,
                    'status', sl.status,
                    'ktv_name', (SELECT u.full_name FROM public.users u WHERE u.id = sl.completed_by_ktv_id),
                    'package_name', b.package_name,
                    'has_photos', (
                        SELECT COUNT(*) > 0 FROM public.session_media sm
                        WHERE sm.session_log_id = sl.id
                    ),
                    'review_rating', (
                        SELECT sr.rating FROM public.session_reviews sr
                        WHERE sr.session_log_id = sl.id
                          AND sr.tenant_id = v_tenant_id
                        LIMIT 1
                    )
                ) ORDER BY sl.completed_date DESC NULLS LAST
            ), '[]'::jsonb)
            FROM public.session_logs sl
            JOIN public.bookings b ON sl.booking_id = b.id
            WHERE b.customer_id = p_customer_id
              AND b.tenant_id = v_tenant_id
              AND sl.status = 'completed'
            LIMIT p_sessions_limit
        ),

        -- ── Care notes (pinned first) ──
        'care_notes', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', cn.id,
                    'note_type', cn.note_type,
                    'content', cn.content,
                    'is_pinned', cn.is_pinned,
                    'written_by_name', (SELECT u.full_name FROM public.users u WHERE u.id = cn.written_by),
                    'created_at', cn.created_at
                ) ORDER BY cn.is_pinned DESC, cn.created_at DESC
            ), '[]'::jsonb)
            FROM public.customer_care_notes cn
            WHERE cn.customer_id = p_customer_id
              AND cn.tenant_id = v_tenant_id
              AND (cn.is_visible_to_all_ktv = TRUE
                   OR EXISTS (
                       SELECT 1 FROM public.users u
                       WHERE u.id = v_caller_id AND u.role IN ('admin', 'super_admin', 'hr')
                   ))
            LIMIT 20
        )

    ) INTO v_result;

    RETURN COALESCE(v_result, jsonb_build_object('error', 'UNKNOWN'));
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.rpc_mobile_get_customer_profile(UUID, INTEGER) TO authenticated;


-- ============================================================
-- RPC 2: Lấy danh sách ảnh của 1 session
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_mobile_get_session_media(
    p_session_log_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_result JSONB;
BEGIN
    SELECT tenant_id INTO v_tenant_id
    FROM public.users WHERE id = auth.uid();

    -- Verify session thuộc tenant
    IF NOT EXISTS (
        SELECT 1 FROM public.session_logs
        WHERE id = p_session_log_id AND tenant_id = v_tenant_id
    ) THEN
        RETURN jsonb_build_object('error', 'SESSION_NOT_FOUND');
    END IF;

    SELECT jsonb_build_object(
        'media', COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', sm.id,
                'storage_path', sm.storage_path,
                'storage_bucket', sm.storage_bucket,
                'media_type', sm.media_type,
                'caption', sm.caption,
                'file_size_bytes', sm.file_size_bytes,
                'uploaded_by_name', (SELECT u.full_name FROM public.users u WHERE u.id = sm.uploaded_by),
                'created_at', sm.created_at
            ) ORDER BY sm.media_type, sm.created_at ASC
        ), '[]'::jsonb),
        'total_count', COUNT(sm.id)
    )
    INTO v_result
    FROM public.session_media sm
    WHERE sm.session_log_id = p_session_log_id
      AND sm.tenant_id = v_tenant_id;

    RETURN COALESCE(v_result, jsonb_build_object('media', '[]'::jsonb, 'total_count', 0));
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.rpc_mobile_get_session_media(UUID) TO authenticated;


-- ============================================================
-- RPC 3: Save session media metadata (sau khi upload lên Storage)
-- Upload flow: Mobile → Supabase Storage → gọi RPC này để lưu metadata
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_mobile_save_session_media(
    p_session_log_id UUID,
    p_storage_path TEXT,
    p_media_type TEXT DEFAULT 'after_photo',
    p_caption TEXT DEFAULT NULL,
    p_file_size_bytes INTEGER DEFAULT NULL,
    p_width INTEGER DEFAULT NULL,
    p_height INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_uploader_id UUID := auth.uid();
    v_tenant_id UUID;
    v_customer_id UUID;
    v_count INTEGER;
    v_new_id UUID;
BEGIN
    SELECT tenant_id INTO v_tenant_id
    FROM public.users WHERE id = v_uploader_id;

    -- Verify session + lấy customer_id
    SELECT b.customer_id INTO v_customer_id
    FROM public.session_logs sl
    JOIN public.bookings b ON sl.booking_id = b.id
    WHERE sl.id = p_session_log_id
      AND sl.tenant_id = v_tenant_id;

    IF v_customer_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'SESSION_NOT_FOUND');
    END IF;

    -- Giới hạn: tối đa 6 ảnh/media_type/session (chống abuse)
    SELECT COUNT(*) INTO v_count
    FROM public.session_media
    WHERE session_log_id = p_session_log_id
      AND media_type = p_media_type
      AND tenant_id = v_tenant_id;

    IF v_count >= 6 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'MAX_MEDIA_REACHED',
            'message', 'Tối đa 6 ảnh cho mỗi loại trong cùng buổi');
    END IF;

    INSERT INTO public.session_media (
        tenant_id, session_log_id, customer_id, uploaded_by,
        storage_path, media_type, caption, file_size_bytes, width, height
    ) VALUES (
        v_tenant_id, p_session_log_id, v_customer_id, v_uploader_id,
        p_storage_path, p_media_type, p_caption, p_file_size_bytes, p_width, p_height
    ) RETURNING id INTO v_new_id;

    RETURN jsonb_build_object('ok', true, 'media_id', v_new_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_mobile_save_session_media(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER) TO authenticated;


-- ============================================================
-- RPC 4: Thêm/sửa customer care note
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_mobile_upsert_care_note(
    p_customer_id UUID,
    p_note_type TEXT,
    p_content TEXT,
    p_is_pinned BOOLEAN DEFAULT FALSE,
    p_is_visible_to_all_ktv BOOLEAN DEFAULT TRUE,
    p_note_id UUID DEFAULT NULL   -- NULL = tạo mới, có value = cập nhật
)
RETURNS JSONB AS $$
DECLARE
    v_writer_id UUID := auth.uid();
    v_tenant_id UUID;
    v_writer_role TEXT;
    v_note_id UUID;
BEGIN
    SELECT tenant_id, role INTO v_tenant_id, v_writer_role
    FROM public.users WHERE id = v_writer_id;

    -- Verify customer thuộc tenant
    IF NOT EXISTS (
        SELECT 1 FROM public.customers
        WHERE id = p_customer_id AND tenant_id = v_tenant_id
    ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'CUSTOMER_NOT_FOUND');
    END IF;

    -- Chỉ admin/hr được set is_visible_to_all_ktv = FALSE (confidential notes)
    IF p_is_visible_to_all_ktv = FALSE AND v_writer_role NOT IN ('admin', 'super_admin', 'hr') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_PERMISSIONS',
            'message', 'Chỉ Admin/HR mới có thể tạo ghi chú bảo mật');
    END IF;

    IF p_note_id IS NULL THEN
        -- Tạo mới
        INSERT INTO public.customer_care_notes (
            tenant_id, customer_id, written_by,
            note_type, content, is_pinned, is_visible_to_all_ktv
        ) VALUES (
            v_tenant_id, p_customer_id, v_writer_id,
            p_note_type, p_content, p_is_pinned, p_is_visible_to_all_ktv
        ) RETURNING id INTO v_note_id;
    ELSE
        -- Cập nhật — chỉ người viết hoặc admin
        UPDATE public.customer_care_notes
        SET content = p_content,
            note_type = p_note_type,
            is_pinned = p_is_pinned,
            updated_at = NOW()
        WHERE id = p_note_id
          AND tenant_id = v_tenant_id
          AND (written_by = v_writer_id OR v_writer_role IN ('admin', 'super_admin'));

        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED_OR_NOT_FOUND');
        END IF;
        v_note_id := p_note_id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'note_id', v_note_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_mobile_upsert_care_note(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, UUID) TO authenticated;
```

---

## 2. Mobile App — Media Upload Service

### [NEW] `apps/mobile/src/services/media/sessionMedia.ts`

```typescript
// apps/mobile/src/services/media/sessionMedia.ts
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { getMobileSupabase } from '../../lib/supabase';

export type MediaType = 'before_photo' | 'after_photo' | 'reference_photo' | 'note_attachment';

export interface UploadResult {
  ok: boolean;
  media_id?: string;
  storage_path?: string;
  error?: string;
}

// Resize ảnh trước khi upload: max 1080px, quality 0.80
const MAX_DIMENSION = 1080;
const JPEG_QUALITY = 0.80;

async function resizeImage(uri: string): Promise<{
  uri: string; width: number; height: number;
}> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result;
}

export async function pickAndUploadSessionPhoto(
  sessionLogId: string,
  tenantId: string,
  mediaType: MediaType,
  caption?: string
): Promise<UploadResult> {
  // 1. Xin permission
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    return { ok: false, error: 'Cần cấp quyền camera để chụp ảnh' };
  }

  // 2. Chụp ảnh (hoặc chọn từ gallery)
  const pickerResult = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 1,
    exif: false, // Không lưu EXIF để bảo vệ privacy
  });

  if (pickerResult.canceled) return { ok: false, error: 'CANCELLED' };

  const asset = pickerResult.assets[0];

  // 3. Resize ảnh để tiết kiệm storage
  const resized = await resizeImage(asset.uri);

  // 4. Đọc file thành ArrayBuffer
  const response = await fetch(resized.uri);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();

  // 5. Tạo storage path: {tenantId}/{sessionLogId}/{mediaType}_{timestamp}.jpg
  const timestamp = Date.now();
  const filename = `${mediaType}_${timestamp}.jpg`;
  const storagePath = `${tenantId}/${sessionLogId}/${filename}`;

  // 6. Upload lên Supabase Storage
  const supabase = getMobileSupabase();
  const { error: uploadError } = await supabase.storage
    .from('session-media')
    .upload(storagePath, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  // 7. Lưu metadata vào DB qua RPC
  const { data, error: rpcError } = await supabase.rpc(
    'rpc_mobile_save_session_media',
    {
      p_session_log_id: sessionLogId,
      p_storage_path: storagePath,
      p_media_type: mediaType,
      p_caption: caption ?? null,
      p_file_size_bytes: blob.size,
      p_width: resized.width,
      p_height: resized.height,
    }
  );

  if (rpcError || !data?.ok) {
    // Xóa file đã upload nếu RPC fail
    await supabase.storage.from('session-media').remove([storagePath]);
    return { ok: false, error: rpcError?.message ?? data?.error ?? 'RPC_ERROR' };
  }

  return { ok: true, media_id: data.media_id, storage_path: storagePath };
}

/** Lấy signed URL để hiển thị ảnh (bucket private) */
export async function getMediaSignedUrl(storagePath: string): Promise<string | null> {
  const supabase = getMobileSupabase();
  const { data, error } = await supabase.storage
    .from('session-media')
    .createSignedUrl(storagePath, 3600); // 1 giờ

  if (error || !data) return null;
  return data.signedUrl;
}

/** Xóa media (chỉ người upload hoặc admin) */
export async function deleteSessionMedia(
  mediaId: string,
  storagePath: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getMobileSupabase();

  // Xóa metadata trước
  const { error: dbError } = await supabase
    .from('session_media')
    .delete()
    .eq('id', mediaId);

  if (dbError) return { ok: false, error: dbError.message };

  // Xóa file trong storage
  await supabase.storage.from('session-media').remove([storagePath]);

  return { ok: true };
}
```

---

## 3. Mobile App — Customer Profile Service

### [NEW] `apps/mobile/src/services/customer/customerProfile.ts`

```typescript
// apps/mobile/src/services/customer/customerProfile.ts
import { getMobileSupabase } from '../../lib/supabase';
import { LocalCacheService } from '../../lib/localCache';

export interface CustomerProfile {
  customer: {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    avatar_url: string | null;
    created_at: string;
    total_bookings: number;
    total_completed_sessions: number;
    avg_review_given: number | null;
  };
  packages: PackageSummary[];
  recent_sessions: RecentSession[];
  care_notes: CareNote[];
}

export interface PackageSummary {
  booking_id: string;
  booking_number: string;
  package_name: string;
  status: string;
  total_sessions: number;
  completed_sessions: number;
  assigned_ktv_name: string | null;
  started_at: string;
  source: 'new' | 'renewal';
}

export interface RecentSession {
  session_id: string;
  completed_date: string;
  status: string;
  ktv_name: string | null;
  package_name: string;
  has_photos: boolean;
  review_rating: number | null;
}

export interface CareNote {
  id: string;
  note_type: 'allergy' | 'preference' | 'warning' | 'general' | 'recommendation';
  content: string;
  is_pinned: boolean;
  written_by_name: string;
  created_at: string;
}

// TTL: profile cache 5 phút (cập nhật sau mỗi tương tác)
const TTL_PROFILE = 5 * 60 * 1000;
const cacheKey = (id: string) => `customer_profile_${id}`;

export async function fetchCustomerProfile(
  customerId: string,
  options: { forceRefresh?: boolean } = {}
): Promise<CustomerProfile | { error: string }> {
  if (!options.forceRefresh) {
    const cached = await LocalCacheService.get<CustomerProfile>(cacheKey(customerId));
    if (cached) return cached;
  }

  const supabase = getMobileSupabase();
  const { data, error } = await supabase.rpc('rpc_mobile_get_customer_profile', {
    p_customer_id: customerId,
    p_sessions_limit: 10,
  });

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };

  await LocalCacheService.set(cacheKey(customerId), data, TTL_PROFILE);
  return data as CustomerProfile;
}

export async function invalidateCustomerCache(customerId: string): Promise<void> {
  await LocalCacheService.invalidate(cacheKey(customerId));
}

export async function addCareNote(
  customerId: string,
  noteType: CareNote['note_type'],
  content: string,
  options: { isPinned?: boolean; visibleToAllKtv?: boolean } = {}
): Promise<{ ok: boolean; note_id?: string; error?: string }> {
  const supabase = getMobileSupabase();
  const { data, error } = await supabase.rpc('rpc_mobile_upsert_care_note', {
    p_customer_id: customerId,
    p_note_type: noteType,
    p_content: content,
    p_is_pinned: options.isPinned ?? false,
    p_is_visible_to_all_ktv: options.visibleToAllKtv ?? true,
    p_note_id: null,
  });

  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error };

  // Invalidate cache sau khi thêm note
  await invalidateCustomerCache(customerId);
  return { ok: true, note_id: data.note_id };
}
```

---

## 4. Mobile App — UI Components

### [NEW] `apps/mobile/src/components/customer/CustomerProfileHeader.tsx`

```typescript
// apps/mobile/src/components/customer/CustomerProfileHeader.tsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import type { CustomerProfile } from '../../services/customer/customerProfile';

interface Props {
  customer: CustomerProfile['customer'];
}

export function CustomerProfileHeader({ customer }: Props) {
  return (
    <View style={styles.container}>
      {customer.avatar_url ? (
        <Image source={{ uri: customer.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarInitial}>{customer.full_name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name}>{customer.full_name}</Text>
        <Text style={styles.phone}>{customer.phone}</Text>
        {customer.email && <Text style={styles.email}>{customer.email}</Text>}
      </View>
      <View style={styles.stats}>
        <StatItem label="Gói đã dùng" value={customer.total_bookings} />
        <StatItem label="Buổi hoàn thành" value={customer.total_completed_sessions} />
        <StatItem
          label="Rating trung bình"
          value={customer.avg_review_given ? `⭐ ${customer.avg_review_given}` : '—'}
        />
      </View>
    </View>
  );
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#FFF', padding: 20, borderRadius: 16, margin: 16, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignSelf: 'center', marginBottom: 12 },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#6366F1',
    justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 12 },
  avatarInitial: { fontSize: 28, color: '#FFF', fontWeight: '800' },
  info: { alignItems: 'center', marginBottom: 16 },
  name: { fontSize: 20, fontWeight: '800', color: '#111827' },
  phone: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  email: { fontSize: 13, color: '#9CA3AF', marginTop: 1 },
  stats: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 16,
    borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#10B981' },
  statLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 2, textAlign: 'center' },
});
```

### [NEW] `apps/mobile/src/components/customer/CareNoteItem.tsx`

```typescript
// apps/mobile/src/components/customer/CareNoteItem.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { CareNote } from '../../services/customer/customerProfile';

const NOTE_CONFIG: Record<CareNote['note_type'], { icon: string; color: string; bg: string }> = {
  allergy:        { icon: '⚠️', color: '#DC2626', bg: '#FEE2E2' },
  warning:        { icon: '🚨', color: '#D97706', bg: '#FEF3C7' },
  preference:     { icon: '💜', color: '#7C3AED', bg: '#EDE9FE' },
  recommendation: { icon: '💡', color: '#0891B2', bg: '#E0F2FE' },
  general:        { icon: '📝', color: '#374151', bg: '#F3F4F6' },
};

interface Props {
  note: CareNote;
}

export function CareNoteItem({ note }: Props) {
  const cfg = NOTE_CONFIG[note.note_type];
  return (
    <View style={[styles.container, { backgroundColor: cfg.bg, borderLeftColor: cfg.color }]}>
      <View style={styles.header}>
        <Text style={styles.icon}>{cfg.icon}</Text>
        {note.is_pinned && <Text style={styles.pinned}>📌 Đã ghim</Text>}
        <Text style={[styles.type, { color: cfg.color }]}>
          {note.note_type.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.content}>{note.content}</Text>
      <Text style={styles.meta}>{note.written_by_name} · {new Date(note.created_at).toLocaleDateString('vi-VN')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderLeftWidth: 4, borderRadius: 8, padding: 12, marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  icon: { fontSize: 16 },
  type: { fontSize: 10, fontWeight: '800', letterSpacing: 0.06 },
  pinned: { fontSize: 10, color: '#9CA3AF', marginLeft: 'auto' },
  content: { fontSize: 14, color: '#1F2937', lineHeight: 20 },
  meta: { fontSize: 11, color: '#9CA3AF', marginTop: 6 },
});
```

### [NEW] `apps/mobile/src/components/media/SessionPhotoGallery.tsx`

```typescript
// apps/mobile/src/components/media/SessionPhotoGallery.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert
} from 'react-native';
import { getMobileSupabase } from '../../lib/supabase';
import { getMediaSignedUrl, pickAndUploadSessionPhoto, MediaType } from '../../services/media/sessionMedia';

interface MediaItem {
  id: string;
  storage_path: string;
  media_type: MediaType;
  caption: string | null;
  signed_url?: string;
}

interface Props {
  sessionLogId: string;
  tenantId: string;
  canUpload?: boolean;
}

export function SessionPhotoGallery({ sessionLogId, tenantId, canUpload = true }: Props) {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const loadMedia = async () => {
    const supabase = getMobileSupabase();
    const { data } = await supabase.rpc('rpc_mobile_get_session_media', {
      p_session_log_id: sessionLogId,
    });

    if (data?.media) {
      // Load signed URLs
      const withUrls = await Promise.all(
        (data.media as MediaItem[]).map(async (m) => ({
          ...m,
          signed_url: (await getMediaSignedUrl(m.storage_path)) ?? undefined,
        }))
      );
      setMediaList(withUrls);
    }
    setLoading(false);
  };

  useEffect(() => { loadMedia(); }, [sessionLogId]);

  const handleUpload = async (mediaType: MediaType) => {
    setUploading(true);
    const result = await pickAndUploadSessionPhoto(sessionLogId, tenantId, mediaType);
    setUploading(false);

    if (!result.ok) {
      if (result.error !== 'CANCELLED') {
        Alert.alert('Lỗi', result.error ?? 'Không thể tải ảnh lên');
      }
      return;
    }

    await loadMedia(); // Refresh gallery
  };

  if (loading) return <ActivityIndicator color="#6366F1" style={{ margin: 20 }} />;

  const beforePhotos = mediaList.filter(m => m.media_type === 'before_photo');
  const afterPhotos  = mediaList.filter(m => m.media_type === 'after_photo');

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>📷 Ảnh Buổi Dịch Vụ</Text>

      {/* Before photos */}
      <PhotoRow
        label="Trước dịch vụ"
        items={beforePhotos}
        canUpload={canUpload && beforePhotos.length < 6}
        onUpload={() => handleUpload('before_photo')}
        uploading={uploading}
      />

      {/* After photos */}
      <PhotoRow
        label="Sau dịch vụ"
        items={afterPhotos}
        canUpload={canUpload && afterPhotos.length < 6}
        onUpload={() => handleUpload('after_photo')}
        uploading={uploading}
      />
    </View>
  );
}

function PhotoRow({ label, items, canUpload, onUpload, uploading }: {
  label: string; items: MediaItem[];
  canUpload: boolean; onUpload: () => void; uploading: boolean;
}) {
  return (
    <View style={styles.photoRow}>
      <Text style={styles.rowLabel}>{label} ({items.length}/6)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.photoList}>
          {items.map(item => (
            <View key={item.id} style={styles.photoThumb}>
              {item.signed_url ? (
                <Image source={{ uri: item.signed_url }} style={styles.thumbImage} />
              ) : (
                <View style={[styles.thumbImage, { backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' }]}>
                  <Text>🖼</Text>
                </View>
              )}
            </View>
          ))}
          {canUpload && (
            <TouchableOpacity style={styles.addPhotoBtn} onPress={onUpload} disabled={uploading}>
              {uploading
                ? <ActivityIndicator color="#6366F1" />
                : <Text style={styles.addPhotoBtnText}>+ Chụp</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#FFF', margin: 16, borderRadius: 12, padding: 16, elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  photoRow: { marginBottom: 16 },
  rowLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 8 },
  photoList: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  photoThumb: { width: 80, height: 80, borderRadius: 8, overflow: 'hidden' },
  thumbImage: { width: 80, height: 80 },
  addPhotoBtn: { width: 80, height: 80, borderRadius: 8, borderWidth: 2, borderColor: '#6366F1',
    borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: '#EEF2FF' },
  addPhotoBtnText: { fontSize: 12, color: '#6366F1', fontWeight: '700', textAlign: 'center' },
});
```

---

## 5. Mobile App — Customer Profile Screen

### [NEW] `apps/mobile/src/app/(app)/customer/[customerId].tsx`

```typescript
// apps/mobile/src/app/(app)/customer/[customerId].tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, ScrollView, RefreshControl, ActivityIndicator,
  Text, StyleSheet, TouchableOpacity
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';
import { CustomerProfileHeader } from '../../../components/customer/CustomerProfileHeader';
import { CareNoteItem } from '../../../components/customer/CareNoteItem';
import { SessionPhotoGallery } from '../../../components/media/SessionPhotoGallery';
import { fetchCustomerProfile, invalidateCustomerCache } from '../../../services/customer/customerProfile';
import type { CustomerProfile, CareNote } from '../../../services/customer/customerProfile';
import AddCareNoteModal from '../../../components/customer/AddCareNoteModal';

const TABS = ['Tổng quan', 'Lịch sử', 'Ghi chú'] as const;
type Tab = typeof TABS[number];

export default function CustomerProfileScreen() {
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('Tổng quan');
  const [showAddNote, setShowAddNote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (forceRefresh = false) => {
    setError(null);
    const res = await fetchCustomerProfile(customerId!, { forceRefresh });
    if ('error' in res) setError(res.error);
    else setProfile(res);
  }, [customerId]);

  useEffect(() => {
    setLoading(true);
    loadProfile().finally(() => setLoading(false));
  }, [loadProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await invalidateCustomerCache(customerId!);
    await loadProfile(true);
    setRefreshing(false);
  }, [customerId, loadProfile]);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#6366F1" />;
  if (error || !profile) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#EF4444' }}>{error ?? 'Không tìm thấy khách hàng'}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <CustomerProfileHeader customer={profile.customer} />

        {activeTab === 'Tổng quan' && (
          <View>
            {/* Package summary */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📦 Gói Dịch Vụ ({profile.packages.length})</Text>
              {profile.packages.map(pkg => (
                <View key={pkg.booking_id} style={styles.packageCard}>
                  <Text style={styles.packageName}>{pkg.package_name}</Text>
                  <Text style={styles.packageMeta}>
                    {pkg.booking_number} · {pkg.completed_sessions}/{pkg.total_sessions} buổi
                    {pkg.source === 'renewal' ? ' · 🔄 Gia hạn' : ''}
                  </Text>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, {
                      width: `${Math.min((pkg.completed_sessions / pkg.total_sessions) * 100, 100)}%`
                    }]} />
                  </View>
                </View>
              ))}
            </View>

            {/* Pinned care notes */}
            {profile.care_notes.filter(n => n.is_pinned).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📌 Lưu Ý Quan Trọng</Text>
                {profile.care_notes.filter(n => n.is_pinned).map(note => (
                  <CareNoteItem key={note.id} note={note} />
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === 'Lịch sử' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📅 Lịch Sử Buổi Dịch Vụ</Text>
            {profile.recent_sessions.map(session => (
              <View key={session.session_id} style={styles.sessionCard}>
                <Text style={styles.sessionDate}>
                  {session.completed_date
                    ? new Date(session.completed_date).toLocaleDateString('vi-VN')
                    : 'Chưa hoàn thành'}
                </Text>
                <Text style={styles.sessionInfo}>
                  {session.package_name} · {session.ktv_name ?? '—'}
                </Text>
                <View style={styles.sessionBadges}>
                  {session.review_rating && (
                    <Text style={styles.ratingBadge}>⭐ {session.review_rating}/5</Text>
                  )}
                  {session.has_photos && (
                    <Text style={styles.photoBadge}>📷 Có ảnh</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'Ghi chú' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📝 Ghi Chú Chăm Sóc</Text>
              <TouchableOpacity
                style={styles.addNoteBtn}
                onPress={() => setShowAddNote(true)}
              >
                <Text style={styles.addNoteBtnText}>+ Thêm</Text>
              </TouchableOpacity>
            </View>
            {profile.care_notes.map(note => (
              <CareNoteItem key={note.id} note={note} />
            ))}
            {profile.care_notes.length === 0 && (
              <Text style={styles.emptyText}>Chưa có ghi chú. Thêm lưu ý về sở thích, dị ứng...</Text>
            )}
          </View>
        )}

      </ScrollView>

      {showAddNote && (
        <AddCareNoteModal
          customerId={customerId!}
          onClose={() => setShowAddNote(false)}
          onSaved={async () => {
            setShowAddNote(false);
            await invalidateCustomerCache(customerId!);
            await loadProfile(true);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#6366F1' },
  tabText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  tabTextActive: { color: '#6366F1', fontWeight: '700' },
  section: { margin: 16, backgroundColor: '#FFF', borderRadius: 12, padding: 16, elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  packageCard: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  packageName: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  packageMeta: { fontSize: 12, color: '#6B7280', marginVertical: 4 },
  progressBar: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 3 },
  sessionCard: { marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  sessionDate: { fontSize: 13, fontWeight: '700', color: '#374151' },
  sessionInfo: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  sessionBadges: { flexDirection: 'row', gap: 6, marginTop: 4 },
  ratingBadge: { fontSize: 11, color: '#F59E0B', fontWeight: '600' },
  photoBadge: { fontSize: 11, color: '#6366F1', fontWeight: '600' },
  addNoteBtn: { backgroundColor: '#6366F1', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  addNoteBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  emptyText: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 },
});
```

---

## 6. Cập Nhật Session Detail — Tích Hợp Camera

### [MODIFY] `apps/mobile/src/app/(app)/session/[sessionId].tsx`

Sau khi hoàn thành buổi, hiển thị thêm section chụp ảnh:

```typescript
// Thêm vào phần render sau khi session status = 'completed'
{session.status === 'completed' && (
  <SessionPhotoGallery
    sessionLogId={session.id}
    tenantId={user!.tenant_id}
    canUpload={true}
  />
)}

// Thêm nút "Xem Hồ Sơ Khách" trong session detail
<TouchableOpacity
  style={styles.customerProfileBtn}
  onPress={() => router.push(`/customer/${session.customer_id}`)}
>
  <Text style={styles.customerProfileBtnText}>👤 Xem Hồ Sơ Khách Hàng</Text>
</TouchableOpacity>
```

---

## Thứ Tự Thực Thi

```
── Supabase Backend ──────────────────────────────────────────────────────
Bước 1   Tạo Storage bucket 'session-media' (private, 5MB limit)
          → Supabase Dashboard → Storage → New Bucket

Bước 2   Apply migration 20260809000000_session_media.sql
          → Tables: session_media, customer_care_notes
          → RLS policies, indexes

Bước 3   Apply migration 20260809000001_customer_profile_rpcs.sql
          → rpc_mobile_get_customer_profile
          → rpc_mobile_get_session_media
          → rpc_mobile_save_session_media
          → rpc_mobile_upsert_care_note

── Mobile App ────────────────────────────────────────────────────────────
Bước 4   Cài dependencies:
          npx expo install expo-image-picker expo-image-manipulator

Bước 5   Thêm permissions vào app.json:
          ios.infoPlist.NSCameraUsageDescription
          android.permissions: CAMERA, READ_EXTERNAL_STORAGE

Bước 6   Tạo apps/mobile/src/services/media/sessionMedia.ts
Bước 7   Tạo apps/mobile/src/services/customer/customerProfile.ts
Bước 8   Tạo components: CustomerProfileHeader, CareNoteItem,
          SessionPhotoGallery, AddCareNoteModal
Bước 9   Tạo màn hình apps/mobile/src/app/(app)/customer/[customerId].tsx
Bước 10  Cập nhật session detail → thêm gallery + customer profile link
```

---

## Verification Plan

### Camera & Media

| Bước | Thực hiện | Kết quả mong đợi |
|---|---|---|
| 1 | Chụp ảnh "before" trong session | File upload lên `session-media/{tenantId}/{sessionId}/before_*`, metadata lưu DB |
| 2 | Upload 7 ảnh cùng loại | RPC trả `MAX_MEDIA_REACHED` khi quá 6 ảnh |
| 3 | Xem gallery khi offline | Signed URL đã load → hiển thị cache; không crash khi offline |
| 4 | KTV tenant A xem media của tenant B | RLS block, không trả về data |
| 5 | RPC fail sau khi upload Storage | File được xóa khỏi Storage (cleanup), không có orphan files |

### Customer Profile

| Bước | Thực hiện | Kết quả mong đợi |
|---|---|---|
| 1 | Xem profile khách có nhiều gói | Tất cả package hiển thị với progress bar đúng |
| 2 | Thêm care note loại 'allergy' | Note hiển thị màu đỏ, KTV khác thấy khi mở profile |
| 3 | Thêm care note bí mật (is_visible_to_all_ktv=false) bằng KTV thường | `INSUFFICIENT_PERMISSIONS` |
| 4 | Admin thêm note bí mật | Thành công; KTV thường không thấy |
| 5 | Pin note quan trọng | Note hiển thị đầu tiên trong tab "Tổng quan" |
| 6 | Cross-tenant: gọi profile customer khác tenant | `CUSTOMER_NOT_FOUND` |

---

## Danh Sách File Checklist

| File | Trạng thái | Ghi chú |
|---|---|---|
| Storage bucket 'session-media' | **Config** | Qua Dashboard, 5MB limit, private |
| `supabase/migrations/20260809000000_session_media.sql` | **NEW** | session_media + customer_care_notes |
| `supabase/migrations/20260809000001_customer_profile_rpcs.sql` | **NEW** | 4 RPCs |
| `apps/mobile/src/services/media/sessionMedia.ts` | **NEW** | Upload + signed URL + delete |
| `apps/mobile/src/services/customer/customerProfile.ts` | **NEW** | Profile fetch + cache + care note |
| `apps/mobile/src/components/customer/CustomerProfileHeader.tsx` | **NEW** | Header với stats |
| `apps/mobile/src/components/customer/CareNoteItem.tsx` | **NEW** | Note display với màu theo loại |
| `apps/mobile/src/components/customer/AddCareNoteModal.tsx` | **NEW** | Modal thêm note |
| `apps/mobile/src/components/media/SessionPhotoGallery.tsx` | **NEW** | Gallery + upload button |
| `apps/mobile/src/app/(app)/customer/[customerId].tsx` | **NEW** | 3-tab customer profile |
| `apps/mobile/src/app/(app)/session/[sessionId].tsx` | **MODIFY** | Thêm gallery + link profile |

---

## Ghi Chú Kiến Trúc

### Upload Flow — Tại sao Mobile → Storage → RPC (không phải RPC → Storage)?

```
Cách sai: Mobile → RPC → RPC upload Storage
→ RPC không có đủ credentials thao tác Storage
→ File lớn: RPC timeout

Cách đúng:
1. Mobile xin Supabase Storage signed upload URL
2. Mobile upload trực tiếp lên Storage (binary, không qua RPC)
3. Sau khi upload xong → Mobile gọi RPC để lưu metadata (storage_path, size...)
4. Nếu RPC fail → Mobile cleanup file trong Storage
```

### Tại sao Resize ảnh trước upload?

```
iPhone 14 Pro: ảnh raw = 8-12MB
→ Upload chậm trên 4G
→ Storage cost cao
→ Load gallery chậm

Sau resize (1080px, quality 0.8):
→ File size: 150-400KB
→ Chất lượng: đủ dùng cho hồ sơ dịch vụ
→ Upload nhanh gấp 20x
```

### Care Note vs Session Note — Phân biệt rõ

```
session_logs.ktv_note (Tuần 3):
  → Gắn với 1 buổi cụ thể
  → "Khách có vết bầm nhỏ ở vai trái"
  → Không tìm kiếm được cross-session

customer_care_notes (Tuần 9):
  → Gắn với khách hàng (tồn tại mãi)
  → "Dị ứng tinh dầu sả" / "Thích massage nhẹ nhàng"
  → Hiển thị mỗi lần KTV bắt đầu buổi với khách này
```

---

## Định Nghĩa Hoàn Thành (DoD) — Tuần 9

- [ ] **Storage bucket:** `session-media` tạo xong, private, limit 5MB/file.
- [ ] **Camera permission:** App xin permission đúng iOS/Android, không crash khi deny.
- [ ] **Upload flow:** Chụp ảnh → resize → upload Storage → save metadata → hiện trong gallery.
- [ ] **Max limit:** Upload quá 6 ảnh/loại → `MAX_MEDIA_REACHED`, không crash.
- [ ] **RPC fail cleanup:** Upload Storage thành công nhưng RPC fail → file bị xóa khỏi Storage.
- [ ] **Customer profile:** Hiển thị đúng tổng gói, buổi hoàn thành, rating trung bình.
- [ ] **Progress bar:** Tính đúng `completed_sessions / total_sessions` từ session_logs (derived COUNT*).
- [ ] **Care note allergy:** Hiển thị màu đỏ, icon ⚠️, xuất hiện ở "Lưu Ý Quan Trọng" nếu pinned.
- [ ] **Care note secret:** KTV thường không tạo được `is_visible_to_all_ktv=false` → `INSUFFICIENT_PERMISSIONS`.
- [ ] **Cross-tenant isolation:** Tất cả RPCs có kiểm tra `tenant_id` — verify bằng SQL.
- [ ] **Offline gallery:** Signed URLs cached, gallery vẫn hiển thị khi offline (ảnh đã load trước).
- [ ] **Session detail link:** Nút "Xem Hồ Sơ Khách" navigate đúng sang `/customer/:id`.
- [ ] CI pass: Mobile typecheck + `expo-image-picker` permission manifest đúng.
