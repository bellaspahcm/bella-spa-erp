# Hướng Dẫn Phát Triển Admin UI - Quản Lý Đối Tác API

**Dành cho**: Developers  
**Phiên bản**: 1.0  
**Ngày cập nhật**: 18/06/2026

---

## 📋 Mục Lục

1. [Tổng Quan Kiến Trúc](#tổng-quan-kiến-trúc)
2. [Cấu Trúc Thư Mục](#cấu-trúc-thư-mục)
3. [Components](#components)
4. [API Routes](#api-routes)
5. [Types & Interfaces](#types--interfaces)
6. [State Management](#state-management)
7. [Form Validation](#form-validation)
8. [Security](#security)
9. [Testing](#testing)
10. [Deployment](#deployment)

---

## Tổng Quan Kiến Trúc

### Tech Stack

```typescript
{
  "framework": "Next.js 16.2.6 (App Router)",
  "language": "TypeScript 5.x",
  "ui": "shadcn/ui (Base UI components)",
  "styling": "Tailwind CSS",
  "forms": "React Hook Form (dự kiến)",
  "database": "Supabase (PostgreSQL)",
  "notifications": "sonner"
}
```

### Luồng Dữ Liệu

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ User Action
       ▼
┌─────────────────┐
│ React Component │
│  (Client Side)  │
└──────┬──────────┘
       │
       │ fetch()
       ▼
┌─────────────────┐
│   API Route     │
│ (Server Side)   │
└──────┬──────────┘
       │
       │ Service Layer
       ▼
┌─────────────────┐
│ partner.service │
│   (Business)    │
└──────┬──────────┘
       │
       │ Supabase Client
       ▼
┌─────────────────┐
│   PostgreSQL    │
│   (Database)    │
└─────────────────┘
```

---

## Cấu Trúc Thư Mục

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── admin/
│   │       └── partners/
│   │           ├── page.tsx                 # Danh sách đối tác
│   │           ├── new/
│   │           │   └── page.tsx             # Tạo đối tác mới
│   │           └── [id]/
│   │               ├── edit/
│   │               │   └── page.tsx         # Sửa đối tác
│   │               └── page.tsx             # Chi tiết (Phần 3)
│   └── api/
│       └── admin/
│           └── partners/
│               ├── route.ts                 # GET list, POST create
│               ├── [id]/
│               │   ├── route.ts             # GET one, PUT update, DELETE
│               │   └── regenerate-key/
│               │       └── route.ts         # POST regenerate
│               └── export/
│                   └── route.ts             # GET CSV (dự kiến)
│
├── components/
│   ├── admin/
│   │   └── partners/
│   │       ├── PartnerFormWizard.tsx        # Main wizard
│   │       ├── PartnersList.tsx             # List với filters
│   │       ├── PartnersTable.tsx            # Data table
│   │       ├── PartnersListSkeleton.tsx     # Loading state
│   │       └── wizard-steps/
│   │           ├── BasicInfoStep.tsx        # Step 1
│   │           ├── ScopesStep.tsx           # Step 2
│   │           ├── WebhooksStep.tsx         # Step 3
│   │           └── ReviewStep.tsx           # Step 4
│   └── ui/
│       ├── button.tsx                       # shadcn Button
│       ├── input.tsx                        # shadcn Input
│       ├── select.tsx                       # shadcn Select
│       ├── label.tsx                        # shadcn Label
│       ├── badge.tsx                        # shadcn Badge
│       ├── table.tsx                        # shadcn Table
│       ├── alert-dialog.tsx                 # shadcn AlertDialog
│       ├── dropdown-menu.tsx                # shadcn DropdownMenu
│       └── skeleton.tsx                     # shadcn Skeleton
│
├── services/
│   └── api-gateway/
│       └── partner.service.ts               # Business logic
│
└── types/
    └── api-gateway.ts                       # TypeScript types
```

---


## Components

### 1. PartnerFormWizard

**File**: `src/components/admin/partners/PartnerFormWizard.tsx`

**Props**:
```typescript
interface PartnerFormWizardProps {
  mode: 'create' | 'edit';
  existingPartner?: APIPartner;
  tenantId: string;
}
```

**State**:
```typescript
const [currentStep, setCurrentStep] = useState(1);
const [loading, setLoading] = useState(false);
const [formData, setFormData] = useState<PartnerFormData>({ ... });
```

**Chức năng**:
- ✅ Điều hướng 4 bước (progress indicator)
- ✅ Form validation từng bước
- ✅ Submit tạo/cập nhật qua API
- ✅ Toast notifications
- ✅ Auto-redirect sau thành công

**Cách sử dụng**:
```tsx
// Tạo mới
<PartnerFormWizard 
  mode="create" 
  tenantId={currentTenantId} 
/>

// Chỉnh sửa
<PartnerFormWizard 
  mode="edit" 
  existingPartner={partner}
  tenantId={currentTenantId} 
/>
```

---

### 2. BasicInfoStep

**File**: `src/components/admin/partners/wizard-steps/BasicInfoStep.tsx`

**Props**:
```typescript
interface BasicInfoStepProps {
  formData: PartnerFormData;
  updateFormData: (updates: Partial<PartnerFormData>) => void;
}
```

**Fields**:
- `partner_name` * (required)
- `partner_type` * (required)
- `partner_description`
- `contact_email` * (required)
- `contact_phone`
- `is_sandbox` (toggle)

**Validation**:
```typescript
// Trong PartnerFormWizard
case 1: // Basic Info
  if (!formData.partner_name.trim()) {
    toast.error('Tên đối tác là bắt buộc');
    return false;
  }
  if (!formData.contact_email.trim()) {
    toast.error('Email liên hệ là bắt buộc');
    return false;
  }
  return true;
```

---

### 3. ScopesStep

**File**: `src/components/admin/partners/wizard-steps/ScopesStep.tsx`

**Features**:
- ✅ Scope presets (Basic, POS, Payment, HR, Invoice, Admin)
- ✅ Chọn thủ công từng scope
- ✅ Hiển thị số scopes đã chọn
- ✅ Group theo category (Orders, Payments, Invoices, ...)

**State nội bộ**:
```typescript
const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
```

**Functions**:
```typescript
const toggleScope = (scope: APIScope) => {
  const isSelected = formData.allowed_scopes.includes(scope);
  if (isSelected) {
    updateFormData({
      allowed_scopes: currentScopes.filter((s) => s !== scope)
    });
  } else {
    updateFormData({
      allowed_scopes: [...currentScopes, scope]
    });
  }
};

const applyPreset = (presetKey: string) => {
  const scopes = SCOPE_PRESETS[presetKey];
  updateFormData({ allowed_scopes: scopes });
  setSelectedPreset(presetKey);
};
```

**Validation**:
```typescript
case 2: // Scopes
  if (formData.allowed_scopes.length === 0) {
    toast.error('Phải chọn ít nhất một scope');
    return false;
  }
  return true;
```

---

### 4. WebhooksStep

**File**: `src/components/admin/partners/wizard-steps/WebhooksStep.tsx`

**Fields** (tất cả optional):
- `webhook_url`
- `webhook_secret`
- `webhook_events[]`

**Available Events**:
```typescript
const AVAILABLE_EVENTS = [
  { value: 'order.created', label: 'Đơn Hàng Tạo', ... },
  { value: 'order.updated', label: 'Đơn Hàng Cập Nhật', ... },
  { value: 'order.completed', label: 'Đơn Hàng Hoàn Tất', ... },
  { value: 'order.cancelled', label: 'Đơn Hàng Hủy', ... },
  { value: 'payment.received', label: 'Thanh Toán Nhận', ... },
  { value: 'payment.refunded', label: 'Thanh Toán Hoàn', ... },
  { value: 'invoice.created', label: 'Hóa Đơn Tạo', ... },
  { value: 'invoice.cancelled', label: 'Hóa Đơn Hủy', ... },
];
```

---

### 5. ReviewStep

**File**: `src/components/admin/partners/wizard-steps/ReviewStep.tsx`

**Chức năng**:
- ✅ Hiển thị tất cả thông tin đã nhập
- ✅ Badge màu cho environment (Sandbox/Production)
- ✅ Mask webhook secret (••••••)
- ✅ Highlight missing scopes (warning)

---

### 6. PartnersList

**File**: `src/components/admin/partners/PartnersList.tsx`

**Features**:
- ✅ Search bar (real-time)
- ✅ Filters (type, status, sandbox)
- ✅ Pagination (20/page)
- ✅ Refresh button
- ✅ Export button
- ✅ Create button

**State**:
```typescript
const [partners, setPartners] = useState<APIPartner[]>([]);
const [loading, setLoading] = useState(true);
const [pagination, setPagination] = useState({ ... });
const [search, setSearch] = useState('');
const [typeFilter, setTypeFilter] = useState<PartnerType | 'all'>('all');
const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
const [sandboxFilter, setSandboxFilter] = useState<'all' | 'sandbox' | 'production'>('all');
```

**Fetch Function**:
```typescript
const fetchPartners = async () => {
  setLoading(true);
  try {
    const params = new URLSearchParams({
      limit: pagination.limit.toString(),
      offset: pagination.offset.toString(),
    });
    
    if (search) params.set('search', search);
    if (typeFilter !== 'all') params.set('type', typeFilter);
    if (statusFilter !== 'all') params.set('is_active', statusFilter === 'active' ? 'true' : 'false');
    if (sandboxFilter !== 'all') params.set('is_sandbox', sandboxFilter === 'sandbox' ? 'true' : 'false');
    
    const response = await fetch(`/api/admin/partners?${params}`);
    const data = await response.json();
    
    setPartners(data.data);
    setPagination(data.pagination);
  } catch (error) {
    toast.error('Không thể tải danh sách đối tác');
  } finally {
    setLoading(false);
  }
};
```

---

### 7. PartnersTable

**File**: `src/components/admin/partners/PartnersTable.tsx`

**Props**:
```typescript
interface PartnersTableProps {
  partners: APIPartner[];
  loading: boolean;
  onRefresh: () => void;
}
```

**Actions**:
- ✅ View (click row hoặc dropdown)
- ✅ Edit (dropdown)
- ✅ Copy API Key (icon button)
- ✅ Regenerate Key (dropdown với confirm dialog)
- ✅ Delete (dropdown với confirm dialog)

**Dialogs**:
```typescript
const [deleteDialog, setDeleteDialog] = useState<{
  open: boolean;
  partner: APIPartner | null;
}>({ open: false, partner: null });

const [regenerateDialog, setRegenerateDialog] = useState<{
  open: boolean;
  partner: APIPartner | null;
}>({ open: false, partner: null });
```

---

### 8. Partner Detail Page ⭐ MỚI (Phần 3/4)

**File**: `src/app/(dashboard)/admin/partners/[id]/page.tsx`

**Chức năng**: Trang chi tiết đối tác với 5 tabs (Overview, Scopes, Logs, Webhooks, Usage).

**Props**:
```typescript
interface PartnerDetailPageProps {
  params: Promise<{ id: string }>;
}
```

**Data Fetching**:
```typescript
const params = await props.params;
const partnerId = params.id;

// Server-side auth & data fetch
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();

// Get user's tenant
const { data: profile } = await supabase
  .from('users')
  .select('tenant_id')
  .eq('id', user.id)
  .single();

// Fetch partner with tenant security check
const partner = await getPartnerById(partnerId, profile.tenant_id);

if (!partner) {
  notFound();
}
```

**Tab Structure**:
```tsx
<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Tổng Quan</TabsTrigger>
    <TabsTrigger value="scopes">Phân Quyền</TabsTrigger>
    <TabsTrigger value="logs">Nhật Ký</TabsTrigger>
    <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
    <TabsTrigger value="usage">Thống Kê</TabsTrigger>
  </TabsList>
  
  <TabsContent value="overview">
    <PartnerOverviewTab partner={partner} />
  </TabsContent>
  {/* ... other tabs */}
</Tabs>
```

---

#### 8.1. PartnerOverviewTab

**File**: `src/components/admin/partners/detail-tabs/PartnerOverviewTab.tsx`

**Props**:
```typescript
interface PartnerOverviewTabProps {
  partner: APIPartner;
}
```

**Features**:

1. **Card Thông Tin Cơ Bản**: Hiển thị basic info với format date-fns
2. **Card API Key Manager**: 
   - Show/Hide API key (useState toggle)
   - Copy to clipboard
   - Regenerate button với confirm dialog
3. **Card Contact Info**: Email, phone, website
4. **Card Quick Stats**: Total requests, error rate, success rate, last request
5. **Card Notes & Metadata**: Internal notes, created by, updated by

**State**:
```typescript
const [showApiKey, setShowApiKey] = useState(false);
const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
const [isRegenerating, setIsRegenerating] = useState(false);
const [newApiKey, setNewApiKey] = useState<string | null>(null);
```

**Regenerate Key Logic**:
```typescript
const handleRegenerateKey = async () => {
  setIsRegenerating(true);
  try {
    const res = await fetch(`/api/admin/partners/${partner.id}/regenerate-key`, {
      method: 'POST',
    });
    
    if (!res.ok) throw new Error('Failed to regenerate key');
    
    const data = await res.json();
    setNewApiKey(data.data.new_api_key);
    toast.success('API key regenerated successfully');
    
    // Refresh partner data
    router.refresh();
  } catch (error) {
    toast.error('Failed to regenerate API key');
  } finally {
    setIsRegenerating(false);
  }
};
```

**Date Formatting**:
```typescript
import { format, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

// Absolute date
format(new Date(partner.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })

// Relative time
formatDistanceToNow(new Date(partner.last_request_at), { 
  addSuffix: true, 
  locale: vi 
})
// => "2 phút trước"
```

---

#### 8.2. PartnerScopesTab

**File**: `src/components/admin/partners/detail-tabs/PartnerScopesTab.tsx`

**Props**:
```typescript
interface PartnerScopesTabProps {
  partner: APIPartner;
}
```

**Features**:

1. **Visual Scope Manager**: Display scopes grouped by 7 categories
2. **Scope Presets**: 6 quick presets (Basic, POS, Payment, HR, Invoice, Admin)
3. **Toggle Scopes Realtime**: Checkbox để enable/disable
4. **Wildcard Warning**: Alert khi có wildcard scopes (`*`)
5. **Save/Reset Changes**: Validate min 1 scope

**State**:
```typescript
const [selectedScopes, setSelectedScopes] = useState<APIScope[]>(partner.allowed_scopes);
const [isSaving, setIsSaving] = useState(false);
const [hasChanges, setHasChanges] = useState(false);
```

**Scope Categories**:
```typescript
const SCOPE_CATEGORIES = {
  orders: {
    label: '📦 Orders (Đơn Hàng)',
    scopes: ['order:read', 'order:write', 'order:complete', 'order:cancel', 'order:*']
  },
  payments: {
    label: '💳 Payments (Thanh Toán)',
    scopes: ['payment:read', 'payment:write', 'payment:refund', 'payment:*']
  },
  invoices: {
    label: '🧾 Invoices (Hóa Đơn)',
    scopes: ['invoice:read', 'invoice:create', 'invoice:cancel', 'invoice:*']
  },
  pos: {
    label: '🖥️ POS',
    scopes: ['pos:sync', 'pos:read', 'pos:*']
  },
  hr: {
    label: '👥 HR',
    scopes: ['hr:sync', 'hr:read', 'hr:*']
  },
  analytics: {
    label: '📊 Analytics',
    scopes: ['analytics:read', 'analytics:*']
  },
  webhooks: {
    label: '🔔 Webhooks',
    scopes: ['webhook:subscribe', 'webhook:read', 'webhook:*']
  }
};
```

**Toggle Logic**:
```typescript
const toggleScope = (scope: APIScope) => {
  setSelectedScopes(prev => {
    const isSelected = prev.includes(scope);
    const newScopes = isSelected
      ? prev.filter(s => s !== scope)
      : [...prev, scope];
    
    setHasChanges(JSON.stringify(newScopes) !== JSON.stringify(partner.allowed_scopes));
    return newScopes;
  });
};
```

**Save Changes**:
```typescript
const handleSave = async () => {
  if (selectedScopes.length === 0) {
    toast.error('Phải chọn ít nhất 1 scope');
    return;
  }
  
  setIsSaving(true);
  try {
    const res = await fetch(`/api/admin/partners/${partner.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowed_scopes: selectedScopes })
    });
    
    if (!res.ok) throw new Error('Failed to update scopes');
    
    toast.success('Scopes updated successfully');
    setHasChanges(false);
    router.refresh();
  } catch (error) {
    toast.error('Failed to update scopes');
  } finally {
    setIsSaving(false);
  }
};
```

**Wildcard Warning**:
```typescript
const wildcardScopes = selectedScopes.filter(s => s.endsWith(':*'));

{wildcardScopes.length > 0 && (
  <Alert variant="warning">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>⚠️ Wildcard Scopes Detected</AlertTitle>
    <AlertDescription>
      Các scopes sau cấp quyền toàn diện:
      <ul className="mt-2 list-disc pl-5">
        {wildcardScopes.map(scope => (
          <li key={scope}>{scope} (toàn quyền {scope.replace(':*', '')})</li>
        ))}
      </ul>
      Đảm bảo đối tác đáng tin cậy!
    </AlertDescription>
  </Alert>
)}
```

---

#### 8.3. PartnerLogsTab

**File**: `src/components/admin/partners/detail-tabs/PartnerLogsTab.tsx`

**Props**:
```typescript
interface PartnerLogsTabProps {
  partner: APIPartner;
}
```

**Features**:

1. **Table Display**: Request logs với columns (Time, Method, Endpoint, Status, Response Time, Actions)
2. **Filters**: Method, Status, Search endpoint
3. **Pagination**: 20 logs/page
4. **View Details Dialog**: Full request/response details
5. **Export CSV**: Download logs

**State**:
```typescript
const [logs, setLogs] = useState<APIRequestLog[]>([]);
const [loading, setLoading] = useState(true);
const [filters, setFilters] = useState({
  method: 'all',
  status: 'all',
  search: ''
});
const [pagination, setPagination] = useState({
  page: 1,
  pageSize: 20,
  total: 0
});
const [selectedLog, setSelectedLog] = useState<APIRequestLog | null>(null);
const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
```

**Fetch Logs**:
```typescript
const fetchLogs = async () => {
  setLoading(true);
  try {
    const params = new URLSearchParams({
      partner_id: partner.id,
      page: pagination.page.toString(),
      page_size: pagination.pageSize.toString()
    });
    
    if (filters.method !== 'all') params.set('method', filters.method);
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    
    const res = await fetch(`/api/admin/partners/logs?${params}`);
    const data = await res.json();
    
    setLogs(data.data);
    setPagination(prev => ({ ...prev, total: data.pagination.total }));
  } catch (error) {
    toast.error('Failed to load logs');
  } finally {
    setLoading(false);
  }
};
```

**Method Badge Colors**:
```typescript
const getMethodColor = (method: string) => {
  switch (method) {
    case 'GET': return 'bg-blue-100 text-blue-800';
    case 'POST': return 'bg-green-100 text-green-800';
    case 'PUT': return 'bg-yellow-100 text-yellow-800';
    case 'DELETE': return 'bg-red-100 text-red-800';
    case 'PATCH': return 'bg-purple-100 text-purple-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};
```

**Status Badge Colors**:
```typescript
const getStatusColor = (status: number) => {
  if (status >= 200 && status < 300) return 'bg-green-100 text-green-800';
  if (status >= 400 && status < 500) return 'bg-yellow-100 text-yellow-800';
  if (status >= 500) return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-800';
};
```

**View Details Dialog**:
```tsx
<Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
  <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
    <DialogHeader>
      <DialogTitle>Request Details</DialogTitle>
    </DialogHeader>
    
    <Tabs defaultValue="request">
      <TabsList>
        <TabsTrigger value="request">Request</TabsTrigger>
        <TabsTrigger value="response">Response</TabsTrigger>
        {selectedLog?.error && <TabsTrigger value="error">Error</TabsTrigger>}
      </TabsList>
      
      <TabsContent value="request">
        <pre className="bg-gray-50 p-4 rounded text-sm overflow-auto">
          {JSON.stringify(selectedLog?.request, null, 2)}
        </pre>
      </TabsContent>
      
      <TabsContent value="response">
        <pre className="bg-gray-50 p-4 rounded text-sm overflow-auto">
          {JSON.stringify(selectedLog?.response, null, 2)}
        </pre>
      </TabsContent>
      
      {selectedLog?.error && (
        <TabsContent value="error">
          <pre className="bg-red-50 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(selectedLog.error, null, 2)}
          </pre>
        </TabsContent>
      )}
    </Tabs>
  </DialogContent>
</Dialog>
```

**Export CSV**:
```typescript
const handleExportCSV = () => {
  const csvContent = [
    ['Time', 'Method', 'Endpoint', 'Status', 'Response Time (ms)', 'IP Address'],
    ...logs.map(log => [
      format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss'),
      log.method,
      log.endpoint,
      log.status.toString(),
      log.response_time_ms.toString(),
      log.ip_address || 'N/A'
    ])
  ]
    .map(row => row.join(','))
    .join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${partner.partner_name}_logs_${format(new Date(), 'yyyyMMdd')}.csv`);
  link.click();
  
  URL.revokeObjectURL(url);
};
```

---

#### 8.4. PartnerWebhooksTab

**File**: `src/components/admin/partners/detail-tabs/PartnerWebhooksTab.tsx`

**Props**:
```typescript
interface PartnerWebhooksTabProps {
  partner: APIPartner;
}
```

**Features**:

1. **Current Configuration Display**: Hiển thị webhook config hiện tại
2. **Form Config**: URL, Secret, Events
3. **HTTPS Validation**: Chỉ chấp nhận HTTPS URLs
4. **Test Webhook**: Gửi test payload và hiển thị kết quả
5. **Example Payload**: JSON payload mẫu
6. **Save/Reset**: Lưu config mới hoặc reset về ban đầu

**State**:
```typescript
const [webhookUrl, setWebhookUrl] = useState(partner.webhook_url || '');
const [webhookSecret, setWebhookSecret] = useState(partner.webhook_secret || '');
const [webhookEvents, setWebhookEvents] = useState<string[]>(partner.webhook_events || []);
const [showSecret, setShowSecret] = useState(false);
const [isSaving, setIsSaving] = useState(false);
const [isTesting, setIsTesting] = useState(false);
const [testResult, setTestResult] = useState<{
  success: boolean;
  status?: number;
  responseTime?: number;
  message: string;
} | null>(null);
const [hasChanges, setHasChanges] = useState(false);
```

**Available Events**:
```typescript
const WEBHOOK_EVENTS = [
  { value: 'order.created', label: 'Đơn Hàng Tạo', description: 'Đơn hàng mới được tạo' },
  { value: 'order.updated', label: 'Đơn Hàng Cập Nhật', description: 'Đơn hàng được cập nhật' },
  { value: 'order.completed', label: 'Đơn Hàng Hoàn Tất', description: 'Đơn hàng hoàn tất' },
  { value: 'order.cancelled', label: 'Đơn Hàng Hủy', description: 'Đơn hàng bị hủy' },
  { value: 'payment.received', label: 'Thanh Toán Nhận', description: 'Thanh toán được ghi nhận' },
  { value: 'payment.refunded', label: 'Thanh Toán Hoàn', description: 'Thanh toán được hoàn' },
  { value: 'invoice.created', label: 'Hóa Đơn Tạo', description: 'Hóa đơn được tạo' },
  { value: 'invoice.cancelled', label: 'Hóa Đơn Hủy', description: 'Hóa đơn bị hủy' },
];
```

**HTTPS Validation**:
```typescript
const validateWebhookUrl = (url: string): boolean => {
  if (!url) return true; // Optional field
  if (!url.startsWith('https://')) {
    toast.error('Webhook URL phải sử dụng HTTPS');
    return false;
  }
  return true;
};
```

**Test Webhook**:
```typescript
const handleTestWebhook = async () => {
  if (!webhookUrl) {
    toast.error('Vui lòng nhập Webhook URL trước');
    return;
  }
  
  if (!validateWebhookUrl(webhookUrl)) return;
  
  setIsTesting(true);
  setTestResult(null);
  
  try {
    const startTime = Date.now();
    
    const res = await fetch(`/api/admin/partners/${partner.id}/test-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhook_url: webhookUrl,
        webhook_secret: webhookSecret || undefined
      })
    });
    
    const responseTime = Date.now() - startTime;
    const data = await res.json();
    
    if (res.ok && data.success) {
      setTestResult({
        success: true,
        status: data.data.status,
        responseTime,
        message: 'Webhook test successful!'
      });
      toast.success('Webhook test successful');
    } else {
      setTestResult({
        success: false,
        message: data.error?.message || 'Webhook test failed'
      });
      toast.error('Webhook test failed');
    }
  } catch (error) {
    setTestResult({
      success: false,
      message: error instanceof Error ? error.message : 'Connection error'
    });
    toast.error('Failed to test webhook');
  } finally {
    setIsTesting(false);
  }
};
```

**Save Changes**:
```typescript
const handleSave = async () => {
  if (!validateWebhookUrl(webhookUrl)) return;
  
  setIsSaving(true);
  try {
    const res = await fetch(`/api/admin/partners/${partner.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhook_url: webhookUrl || null,
        webhook_secret: webhookSecret || null,
        webhook_events: webhookEvents.length > 0 ? webhookEvents : null
      })
    });
    
    if (!res.ok) throw new Error('Failed to update webhook config');
    
    toast.success('Webhook configuration updated');
    setHasChanges(false);
    router.refresh();
  } catch (error) {
    toast.error('Failed to update webhook configuration');
  } finally {
    setIsSaving(false);
  }
};
```

**Example Payload Display**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Example Webhook Payload</CardTitle>
  </CardHeader>
  <CardContent>
    <pre className="bg-gray-50 p-4 rounded text-sm overflow-auto">
{`{
  "event": "order.created",
  "timestamp": "2026-06-18T10:30:00Z",
  "data": {
    "order_id": "ord_abc123",
    "tenant_id": "ten_xyz789",
    "customer": {
      "id": "cus_456",
      "name": "Nguyễn Văn A",
      "phone": "0901234567"
    },
    "items": [
      {
        "product_id": "prod_111",
        "name": "Massage 90 phút",
        "quantity": 1,
        "price": 500000
      }
    ],
    "total_amount": 500000,
    "payment_status": "pending",
    "created_at": "2026-06-18T10:30:00Z"
  },
  "signature": "sha256=abc123..."
}`}
    </pre>
  </CardContent>
</Card>
```

---

#### 8.5. PartnerUsageTab

**File**: `src/components/admin/partners/detail-tabs/PartnerUsageTab.tsx`

**Props**:
```typescript
interface PartnerUsageTabProps {
  partner: APIPartner;
}
```

**Features**:

1. **4 KPI Cards**: Total Requests, Error Rate, Avg Response Time, P95 Response Time
2. **Requests Chart**: Bar chart theo ngày (7d/30d)
3. **Top 10 Endpoints Table**: Most called endpoints
4. **Rate Limit Status**: Progress bars cho current usage
5. **Health Assessment**: Overall integration health
6. **Time Range Filter**: 24h, 7d, 30d, custom

**State**:
```typescript
const [usageData, setUsageData] = useState<PartnerUsageData | null>(null);
const [loading, setLoading] = useState(true);
const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
```

**Types**:
```typescript
interface PartnerUsageData {
  kpis: {
    total_requests: number;
    error_rate: number;
    avg_response_time: number;
    p95_response_time: number;
  };
  chart_data: Array<{
    date: string;
    success: number;
    client_error: number;
    server_error: number;
  }>;
  top_endpoints: Array<{
    endpoint: string;
    method: string;
    total_calls: number;
    avg_time: number;
    error_rate: number;
  }>;
  rate_limit_status: {
    tier: string;
    per_minute: { used: number; limit: number };
    per_day: { used: number; limit: number };
  };
  health: {
    overall: 'excellent' | 'good' | 'fair' | 'poor';
    uptime: number;
    metrics: Record<string, any>;
  };
}
```

**Fetch Usage Data**:
```typescript
const fetchUsageData = async () => {
  setLoading(true);
  try {
    const res = await fetch(`/api/admin/partners/${partner.id}/usage?timeRange=${timeRange}`);
    const data = await res.json();
    
    if (data.success) {
      setUsageData(data.data);
    }
  } catch (error) {
    toast.error('Failed to load usage data');
  } finally {
    setLoading(false);
  }
};
```

**KPI Card Component**:
```tsx
const KPICard = ({ title, value, icon, trend }: KPICardProps) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {trend && (
        <p className={`text-xs ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
          {trend.value} vs last period
        </p>
      )}
    </CardContent>
  </Card>
);
```

**Rate Limit Progress Bar**:
```tsx
const RateLimitProgress = ({ used, limit, label }: RateLimitProgressProps) => {
  const percentage = (used / limit) * 100;
  const color = percentage < 70 ? 'bg-green-500' : percentage < 90 ? 'bg-yellow-500' : 'bg-red-500';
  
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span>{used}/{limit} ({percentage.toFixed(1)}%)</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`${color} h-2 rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
```

**Health Status Badge**:
```tsx
const getHealthBadge = (health: string) => {
  switch (health) {
    case 'excellent':
      return <Badge className="bg-green-500">🟢 Excellent</Badge>;
    case 'good':
      return <Badge className="bg-blue-500">🟡 Good</Badge>;
    case 'fair':
      return <Badge className="bg-yellow-500">🟠 Fair</Badge>;
    case 'poor':
      return <Badge className="bg-red-500">🔴 Poor</Badge>;
    default:
      return <Badge>Unknown</Badge>;
  }
};
```

**Requests Chart** (using recharts):
```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

<BarChart width={800} height={300} data={usageData.chart_data}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="date" />
  <YAxis />
  <Tooltip />
  <Legend />
  <Bar dataKey="success" fill="#10b981" name="Success (2xx)" />
  <Bar dataKey="client_error" fill="#f59e0b" name="Client Error (4xx)" />
  <Bar dataKey="server_error" fill="#ef4444" name="Server Error (5xx)" />
</BarChart>
```

---

## API Routes

### 1. GET /api/admin/partners

**File**: `src/app/api/admin/partners/route.ts`

**Query Parameters**:
```typescript
{
  type?: PartnerType;
  is_active?: 'true' | 'false';
  is_sandbox?: 'true' | 'false';
  search?: string;
  limit?: number;    // Default: 20
  offset?: number;   // Default: 0
}
```

**Response**:
```typescript
{
  success: true,
  data: APIPartner[],
  pagination: {
    total: number,
    limit: number,
    offset: number,
    has_more: boolean
  }
}
```

**Security**:
- ✅ Authentication check (`supabase.auth.getUser()`)
- ✅ Tenant isolation (filter by `user.tenant_id`)
- ✅ Role check (admin/owner only)

---

### 2. POST /api/admin/partners

**File**: `src/app/api/admin/partners/route.ts`

**Request Body**:
```typescript
interface CreateAPIPartnerInput {
  tenant_id: string;          // Auto-set từ user's tenant
  partner_name: string;       // Required
  partner_type: PartnerType;  // Required
  partner_description?: string;
  contact_email?: string;
  contact_phone?: string;
  
  allowed_scopes: APIScope[]; // Required, min 1
  
  webhook_url?: string;
  webhook_secret?: string;
  webhook_events?: string[];
  
  is_sandbox?: boolean;
  rate_limit_tier?: 'free' | 'basic' | 'pro' | 'enterprise' | 'unlimited';
  notes?: string;
}
```

**Response** (201 Created):
```typescript
{
  success: true,
  data: APIPartner  // Bao gồm api_key mới sinh
}
```

**Business Logic**:
1. Validate required fields
2. Override `tenant_id` với user's tenant (security)
3. Generate API key tự động nếu không có
4. Insert vào `api_partners` table
5. Return partner với API key (chỉ hiển thị 1 lần)

---

### 3. GET /api/admin/partners/[id]

**File**: `src/app/api/admin/partners/[id]/route.ts`

**Response**:
```typescript
{
  success: true,
  data: APIPartner
}
```

**Security**:
- ✅ Check partner belongs to user's tenant
- ✅ Return 404 nếu không tìm thấy hoặc khác tenant

---

### 4. PUT /api/admin/partners/[id]

**File**: `src/app/api/admin/partners/[id]/route.ts`

**Request Body**:
```typescript
interface UpdateAPIPartnerInput {
  partner_name?: string;
  partner_description?: string;
  contact_email?: string;
  contact_phone?: string;
  
  allowed_scopes?: APIScope[];
  
  webhook_url?: string;
  webhook_secret?: string;
  webhook_events?: string[];
  
  rate_limit_tier?: 'free' | 'basic' | 'pro' | 'enterprise' | 'unlimited';
  notes?: string;
}
```

**Không thể sửa**:
- `tenant_id`
- `api_key` (phải dùng regenerate endpoint)
- `is_sandbox` (cố định khi tạo)

**Response**:
```typescript
{
  success: true,
  data: APIPartner  // Updated partner
}
```

---

### 5. DELETE /api/admin/partners/[id]

**File**: `src/app/api/admin/partners/[id]/route.ts`

**Method**: Soft delete (set `is_active = false`)

**Response**:
```typescript
{
  success: true,
  data: {
    message: 'Partner deleted successfully'
  }
}
```

**Side Effects**:
- API key ngừng hoạt động ngay lập tức
- Dữ liệu vẫn được giữ (audit trail)

---

### 6. POST /api/admin/partners/[id]/regenerate-key

**File**: `src/app/api/admin/partners/[id]/regenerate-key/route.ts`

**Response**:
```typescript
{
  success: true,
  data: {
    partner: APIPartner,
    new_api_key: string,  // Key mới
    message: 'API key regenerated successfully. The old key is now invalid.'
  }
}
```

**⚠️ Critical**:
- Key cũ bị vô hiệu hóa **ngay lập tức**
- Key mới chỉ hiển thị **1 lần**
- Update `metadata.api_key_regenerated_at`

---

### 7. GET /api/admin/partners/logs ⭐ MỚI

**File**: `src/app/api/admin/partners/logs/route.ts`

**Query Parameters**:
```typescript
{
  partner_id: string;        // Required
  page?: number;             // Default: 1
  page_size?: number;        // Default: 20
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'all';
  status?: '2xx' | '4xx' | '5xx' | 'all';
  search?: string;           // Search endpoint path
  start_date?: string;       // ISO date
  end_date?: string;         // ISO date
}
```

**Response**:
```typescript
{
  success: true,
  data: APIRequestLog[],
  pagination: {
    page: number,
    page_size: number,
    total: number,
    total_pages: number
  }
}
```

**APIRequestLog Type**:
```typescript
interface APIRequestLog {
  id: string;
  partner_id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  status: number;
  response_time_ms: number;
  ip_address?: string;
  user_agent?: string;
  request: {
    headers: Record<string, string>;
    body?: any;
  };
  response: {
    headers: Record<string, string>;
    body?: any;
  };
  error?: {
    code: string;
    message: string;
    stack_trace?: string;
  };
}
```

**Security**:
- ✅ Check partner belongs to user's tenant
- ✅ Filter logs by partner_id
- ✅ Pagination để tránh overload

---

### 8. GET /api/admin/partners/[id]/usage ⭐ MỚI

**File**: `src/app/api/admin/partners/[id]/usage/route.ts`

**Query Parameters**:
```typescript
{
  timeRange?: '24h' | '7d' | '30d' | 'custom';
  start_date?: string;  // For custom range
  end_date?: string;    // For custom range
}
```

**Response**:
```typescript
{
  success: true,
  data: {
    kpis: {
      total_requests: number,
      error_rate: number,
      avg_response_time: number,
      p95_response_time: number
    },
    chart_data: Array<{
      date: string,
      success: number,
      client_error: number,
      server_error: number
    }>,
    top_endpoints: Array<{
      endpoint: string,
      method: string,
      total_calls: number,
      avg_time: number,
      error_rate: number
    }>,
    rate_limit_status: {
      tier: string,
      per_minute: { used: number, limit: number },
      per_day: { used: number, limit: number }
    },
    health: {
      overall: 'excellent' | 'good' | 'fair' | 'poor',
      uptime: number,
      metrics: Record<string, any>
    }
  }
}
```

**Calculation Logic**:

1. **Total Requests**: COUNT(*) từ request_logs
2. **Error Rate**: (COUNT(status >= 400) / total) * 100
3. **Avg Response Time**: AVG(response_time_ms)
4. **P95 Response Time**: PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms)
5. **Chart Data**: GROUP BY date, COUNT by status range
6. **Top Endpoints**: GROUP BY endpoint + method, ORDER BY COUNT DESC LIMIT 10
7. **Rate Limit Status**: Fetch từ Redis hoặc in-memory cache (current usage)
8. **Health**:
   - Excellent: error_rate < 3%, avg_time < 200ms
   - Good: error_rate < 5%, avg_time < 500ms
   - Fair: error_rate < 10%, avg_time < 1000ms
   - Poor: error_rate >= 10% hoặc avg_time >= 1000ms

---

### 9. POST /api/admin/partners/[id]/test-webhook ⭐ MỚI

**File**: `src/app/api/admin/partners/[id]/test-webhook/route.ts` (dự kiến)

**Request Body**:
```typescript
{
  webhook_url: string;
  webhook_secret?: string;
}
```

**Response** (Success):
```typescript
{
  success: true,
  data: {
    status: 200,
    response_time_ms: 145,
    response_body: any
  }
}
```

**Response** (Failure):
```typescript
{
  success: false,
  error: {
    message: 'Connection timeout',
    code: 'WEBHOOK_TEST_FAILED',
    details: {
      status?: number,
      response_time_ms?: number,
      error_message: string
    }
  }
}
```

**Test Logic**:
```typescript
const testWebhook = async (url: string, secret?: string) => {
  const testPayload = {
    event: 'test.webhook',
    timestamp: new Date().toISOString(),
    data: {
      message: 'This is a test webhook from Bella ERP',
      partner_id: partner.id
    }
  };
  
  // Generate signature nếu có secret
  let signature: string | undefined;
  if (secret) {
    signature = generateWebhookSignature(testPayload, secret);
  }
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BellaERP-Webhook/1.0',
        ...(signature && { 'X-Webhook-Signature': signature })
      },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(5000)  // 5s timeout
    });
    
    const responseTime = Date.now() - startTime;
    
    return {
      success: response.ok,
      status: response.status,
      response_time_ms: responseTime,
      response_body: await response.json().catch(() => null)
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
      response_time_ms: responseTime
    };
  }
};
```

**Security**:
- ✅ Only test URLs starting with https://
- ✅ Timeout 5 seconds
- ✅ Rate limit test requests (max 10/hour per partner)

---


## Types & Interfaces

### APIPartner

**File**: `src/types/api-gateway.ts`

```typescript
export interface APIPartner {
  id: string;
  tenant_id: string;
  
  // Identity
  partner_name: string;
  partner_type: PartnerType;
  partner_description?: string;
  contact_email?: string;
  contact_phone?: string;
  
  // Auth
  api_key: string;
  api_secret?: string;
  
  // Webhooks
  webhook_url?: string;
  webhook_secret?: string;
  webhook_events?: string[];
  
  // Access Control
  allowed_scopes: APIScope[];
  is_active: boolean;
  is_sandbox: boolean;
  
  // Rate Limiting
  rate_limit_tier: 'free' | 'basic' | 'pro' | 'enterprise' | 'unlimited';
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
  rate_limit_burst: number;
  
  // Usage Stats
  last_request_at?: string;
  total_requests_count: number;
  failed_requests_count: number;
  last_error_at?: string;
  last_error_message?: string;
  
  // Metadata
  metadata?: Record<string, any>;
  notes?: string;
  
  // Audit
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}
```

---

### PartnerType

```typescript
export type PartnerType =
  | 'pos'
  | 'payment'
  | 'invoice'
  | 'franchise'
  | 'hr'
  | 'analytics'
  | 'mobile_app'
  | 'other';
```

---

### APIScope

```typescript
export type APIScope =
  // Orders
  | 'order:read'
  | 'order:write'
  | 'order:complete'
  | 'order:cancel'
  | 'order:*'
  
  // Payments
  | 'payment:read'
  | 'payment:write'
  | 'payment:refund'
  | 'payment:*'
  
  // Invoices
  | 'invoice:read'
  | 'invoice:create'
  | 'invoice:cancel'
  | 'invoice:*'
  
  // POS
  | 'pos:sync'
  | 'pos:read'
  | 'pos:*'
  
  // HR
  | 'hr:sync'
  | 'hr:read'
  | 'hr:*'
  
  // Analytics
  | 'analytics:read'
  | 'analytics:*'
  
  // Webhooks
  | 'webhook:subscribe'
  | 'webhook:read'
  | 'webhook:*';
```

---

### SCOPE_PRESETS

```typescript
export const SCOPE_PRESETS: Record<string, APIScope[]> = {
  basic: [
    'order:read',
    'payment:read',
    'analytics:read',
  ],
  
  pos_integration: [
    'order:read',
    'order:write',
    'payment:read',
    'payment:write',
    'pos:sync',
    'pos:read',
  ],
  
  payment_gateway: [
    'order:read',
    'payment:read',
    'payment:write',
    'webhook:subscribe',
  ],
  
  hr_platform: [
    'hr:sync',
    'hr:read',
    'order:read',
    'analytics:read',
  ],
  
  invoice_provider: [
    'invoice:read',
    'invoice:create',
    'invoice:cancel',
    'order:read',
    'payment:read',
  ],
  
  admin: [
    'order:*',
    'payment:*',
    'invoice:*',
    'pos:*',
    'hr:*',
    'analytics:*',
    'webhook:*',
  ],
};
```

---


## State Management

### Client State

Hiện tại sử dụng **React useState** trong từng component.

```typescript
// PartnerFormWizard
const [currentStep, setCurrentStep] = useState(1);
const [loading, setLoading] = useState(false);
const [formData, setFormData] = useState<PartnerFormData>({ ... });

// PartnersList
const [partners, setPartners] = useState<APIPartner[]>([]);
const [loading, setLoading] = useState(true);
const [pagination, setPagination] = useState({ ... });
const [search, setSearch] = useState('');
```

### Server State

Data fetching từ API routes:

```typescript
const fetchPartners = async () => {
  const response = await fetch('/api/admin/partners?...');
  const data = await response.json();
  setPartners(data.data);
};
```

### Future Improvements

Nếu cần state management phức tạp hơn:

**Option 1: React Query / TanStack Query**
```typescript
import { useQuery, useMutation } from '@tanstack/react-query';

const { data, isLoading } = useQuery({
  queryKey: ['partners', filters],
  queryFn: fetchPartners
});

const createMutation = useMutation({
  mutationFn: createPartner,
  onSuccess: () => {
    queryClient.invalidateQueries(['partners']);
  }
});
```

**Option 2: Zustand**
```typescript
// store/partners.ts
import create from 'zustand';

interface PartnersStore {
  partners: APIPartner[];
  loading: boolean;
  fetchPartners: () => Promise<void>;
  createPartner: (input: CreateAPIPartnerInput) => Promise<void>;
}

export const usePartnersStore = create<PartnersStore>((set) => ({
  partners: [],
  loading: false,
  fetchPartners: async () => { ... },
  createPartner: async (input) => { ... }
}));
```

---

## Form Validation

### Validation Rules

#### Step 1: Basic Info
```typescript
const validateBasicInfo = (data: PartnerFormData): boolean => {
  if (!data.partner_name.trim()) {
    toast.error('Tên đối tác là bắt buộc');
    return false;
  }
  
  if (!data.contact_email.trim()) {
    toast.error('Email liên hệ là bắt buộc');
    return false;
  }
  
  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.contact_email)) {
    toast.error('Email không hợp lệ');
    return false;
  }
  
  return true;
};
```

#### Step 2: Scopes
```typescript
const validateScopes = (data: PartnerFormData): boolean => {
  if (data.allowed_scopes.length === 0) {
    toast.error('Phải chọn ít nhất một scope');
    return false;
  }
  return true;
};
```

#### Step 3: Webhooks (All optional)
```typescript
const validateWebhooks = (data: PartnerFormData): boolean => {
  // Nếu có webhook URL, phải là HTTPS
  if (data.webhook_url && !data.webhook_url.startsWith('https://')) {
    toast.error('Webhook URL phải sử dụng HTTPS');
    return false;
  }
  return true;
};
```

### Future: React Hook Form

Nếu cần validation phức tạp hơn:

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const partnerSchema = z.object({
  partner_name: z.string().min(1, 'Tên đối tác là bắt buộc'),
  partner_type: z.enum(['pos', 'payment', ...]),
  contact_email: z.string().email('Email không hợp lệ'),
  allowed_scopes: z.array(z.string()).min(1, 'Phải chọn ít nhất 1 scope'),
  webhook_url: z.string().url().startsWith('https://').optional(),
});

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(partnerSchema)
});
```

---

## Security

### Authentication

Tất cả API routes đều check authentication:

```typescript
const supabase = await createClient();

const {
  data: { user },
} = await supabase.auth.getUser();

if (!user) {
  return NextResponse.json(
    { success: false, error: { message: 'Unauthorized', code: 'AUTH_001' } },
    { status: 401 }
  );
}
```

### Authorization (Role Check)

```typescript
// Get user role
const { data: profile } = await supabase
  .from('users')
  .select('role, tenant_id')
  .eq('id', user.id)
  .single();

// Check role
if (profile.role !== 'admin' && profile.role !== 'owner') {
  return NextResponse.json(
    { success: false, error: { message: 'Forbidden', code: 'AUTHZ_001' } },
    { status: 403 }
  );
}
```

### Tenant Isolation

**Luôn filter theo tenant_id**:

```typescript
// List partners
const { partners, total } = await listPartners({
  tenant_id: profile.tenant_id,  // Bắt buộc
  ...otherFilters
});

// Get one partner
const partner = await getPartnerById(id, profile.tenant_id);
if (!partner) {
  return NextResponse.json({ /* 404 */ }, { status: 404 });
}

// Update partner
const existing = await getPartnerById(id, profile.tenant_id);
if (!existing) {
  return NextResponse.json({ /* 404 */ }, { status: 404 });
}
```

### API Key Security

**Không bao giờ log API keys**:

```typescript
// ❌ BAD
console.log('Creating partner with key:', apiKey);

// ✅ GOOD
console.log('Creating partner:', { 
  name: partner_name, 
  type: partner_type,
  key_format: apiKey.substring(0, 8) + '...' 
});
```

**Mask API keys trong UI**:

```typescript
const maskApiKey = (key: string) => {
  if (key.length <= 12) return key;
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
};
```

### Input Sanitization

**Không trust client input**:

```typescript
// Override tenant_id với user's tenant (security)
body.tenant_id = profile.tenant_id;

// Validate enum values
const validTypes: PartnerType[] = ['pos', 'payment', 'invoice', ...];
if (!validTypes.includes(body.partner_type)) {
  return NextResponse.json({ /* Invalid type */ }, { status: 400 });
}
```

---


## Testing

### Unit Tests (Jest)

**File cần test**: `partner.service.ts`

```typescript
// __tests__/services/partner.service.test.ts
import { createPartner, listPartners, regenerateApiKey } from '@/services/api-gateway/partner.service';

describe('Partner Service', () => {
  describe('createPartner', () => {
    it('should create partner with valid input', async () => {
      const input = {
        tenant_id: 'test-tenant-id',
        partner_name: 'Test Partner',
        partner_type: 'pos',
        contact_email: 'test@example.com',
        allowed_scopes: ['order:read', 'payment:read'],
        is_sandbox: true
      };
      
      const partner = await createPartner(input, 'user-123');
      
      expect(partner.id).toBeDefined();
      expect(partner.partner_name).toBe('Test Partner');
      expect(partner.api_key).toMatch(/^pk_test_/);
    });
    
    it('should throw error when scopes empty', async () => {
      const input = {
        /* ... */
        allowed_scopes: []
      };
      
      await expect(createPartner(input)).rejects.toThrow('At least one scope is required');
    });
  });
  
  describe('regenerateApiKey', () => {
    it('should generate new API key', async () => {
      const partner = await createPartner(validInput, 'user-123');
      const oldKey = partner.api_key;
      
      const { new_api_key } = await regenerateApiKey(partner.id, 'user-123');
      
      expect(new_api_key).not.toBe(oldKey);
      expect(new_api_key).toMatch(/^pk_(test|live)_/);
    });
  });
});
```

### Integration Tests (API Routes)

```typescript
// __tests__/api/admin/partners.test.ts
import { testApiHandler } from 'next-test-api-route-handler';
import * as partnersHandler from '@/app/api/admin/partners/route';

describe('POST /api/admin/partners', () => {
  it('should create partner successfully', async () => {
    await testApiHandler({
      handler: partnersHandler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': 'auth-token=...'  // Mock auth
          },
          body: JSON.stringify({
            partner_name: 'Test Partner',
            partner_type: 'pos',
            contact_email: 'test@example.com',
            allowed_scopes: ['order:read']
          })
        });
        
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(json.data.api_key).toBeDefined();
      }
    });
  });
  
  it('should return 401 when not authenticated', async () => {
    await testApiHandler({
      handler: partnersHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'POST' });
        expect(res.status).toBe(401);
      }
    });
  });
});
```

### E2E Tests (Playwright)

```typescript
// e2e/admin-partners.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Admin Partners UI', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@bella.vn');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });
  
  test('should create new partner', async ({ page }) => {
    // Navigate to partners page
    await page.goto('/admin/partners');
    await page.click('text=New Partner');
    
    // Step 1: Basic Info
    await page.fill('input[name="partner_name"]', 'E2E Test Partner');
    await page.selectOption('select[name="partner_type"]', 'pos');
    await page.fill('input[name="contact_email"]', 'e2e@test.com');
    await page.click('button:has-text("Next")');
    
    // Step 2: Scopes
    await page.click('text=Basic');  // Click preset
    await page.click('button:has-text("Next")');
    
    // Step 3: Webhooks (skip)
    await page.click('button:has-text("Next")');
    
    // Step 4: Review & Create
    await page.click('button:has-text("Create Partner")');
    
    // Verify redirect to detail page
    await expect(page).toHaveURL(/\/admin\/partners\/[a-z0-9-]+$/);
    await expect(page.locator('h1')).toContainText('E2E Test Partner');
  });
  
  test('should edit partner', async ({ page }) => {
    // ... 
  });
  
  test('should regenerate API key', async ({ page }) => {
    // ...
  });
});
```

---

## Deployment

### Build Process

```bash
# 1. Install dependencies
npm install

# 2. Run linter
npm run lint

# 3. Run tests
npm run test

# 4. Build production
npm run build

# 5. Start server
npm run start
```

### Environment Variables

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Vercel Deployment

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["sin1"]
}
```

### Database Migrations

Trước khi deploy, đảm bảo migrations đã chạy:

```sql
-- Migration: 20260617000000_api_gateway_partner_management.sql
CREATE TABLE api_partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  partner_name TEXT NOT NULL,
  partner_type TEXT NOT NULL,
  /* ... */
  CONSTRAINT unique_api_key UNIQUE (api_key)
);

CREATE INDEX idx_api_partners_tenant ON api_partners(tenant_id);
CREATE INDEX idx_api_partners_api_key ON api_partners(api_key);
```

---

## Performance Optimization

### 1. API Response Caching

```typescript
// Add cache headers
export async function GET(request: NextRequest) {
  const response = NextResponse.json({ ... });
  
  response.headers.set(
    'Cache-Control',
    'private, max-age=60, stale-while-revalidate=120'
  );
  
  return response;
}
```

### 2. Database Query Optimization

```typescript
// Sử dụng indexes
.select('*')
.eq('tenant_id', tenantId)  // Indexed
.eq('is_active', true)       // Indexed
.range(offset, offset + limit - 1);

// Limit fields nếu không cần tất cả
.select('id, partner_name, partner_type, is_active')
```

### 3. Lazy Loading Components

```typescript
import dynamic from 'next/dynamic';

const PartnerFormWizard = dynamic(
  () => import('@/components/admin/partners/PartnerFormWizard'),
  { loading: () => <Skeleton /> }
);
```

### 4. Debounce Search

```typescript
import { useMemo } from 'react';
import debounce from 'lodash/debounce';

const debouncedSearch = useMemo(
  () => debounce((value: string) => {
    setSearch(value);
    fetchPartners();
  }, 300),
  []
);
```

---

## Troubleshooting

### Lỗi Build

#### "Export formatCurrency doesn't exist"

**Nguyên nhân**: File khác import `formatCurrency` từ `@/lib/utils` nhưng function không tồn tại.

**Giải pháp**: Đây là lỗi của codebase cũ, không liên quan Admin UI. Tạm thời ignore hoặc fix file utils.

---

#### "Module not found: Can't resolve '@/components/ui/label'"

**Nguyên nhân**: Chưa cài shadcn label component.

**Giải pháp**:
```bash
npx shadcn@latest add label
```

---

### Lỗi Runtime

#### "Partner not found" khi vừa tạo xong

**Nguyên nhân**: Race condition - redirect quá nhanh trước khi DB commit.

**Giải pháp**: Thêm delay nhỏ hoặc polling:
```typescript
const partner = await createPartner(input);

// Wait for DB commit
await new Promise(resolve => setTimeout(resolve, 100));

router.push(`/admin/partners/${partner.id}`);
```

---

## Best Practices

### 1. Component Organization

✅ **Tốt**: Tách nhỏ components
```
PartnerFormWizard/
├── index.tsx
├── BasicInfoStep.tsx
├── ScopesStep.tsx
├── WebhooksStep.tsx
└── ReviewStep.tsx
```

❌ **Tránh**: Component quá lớn (>500 lines)

---

### 2. Error Handling

✅ **Tốt**: Structured error responses
```typescript
try {
  const partner = await createPartner(input);
  return NextResponse.json({ success: true, data: partner }, { status: 201 });
} catch (error) {
  if (error instanceof APIError) {
    return NextResponse.json(
      { success: false, error: { message: error.message, code: error.code } },
      { status: error.statusCode }
    );
  }
  return NextResponse.json(
    { success: false, error: { message: 'Internal server error', code: 'SERVER_001' } },
    { status: 500 }
  );
}
```

❌ **Tránh**: Generic errors
```typescript
} catch (error) {
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
}
```

---

### 3. Type Safety

✅ **Tốt**: Strict typing
```typescript
interface PartnerFormData {
  partner_name: string;
  partner_type: PartnerType;  // Enum type
  allowed_scopes: APIScope[];  // Array of enum
}
```

❌ **Tránh**: Any types
```typescript
const formData: any = { ... };
```

---

## Roadmap

### Phase 3: Partner Detail Page
- [ ] Tabbed interface
- [ ] Overview tab
- [ ] Scopes management tab
- [ ] Request logs viewer
- [ ] Webhooks manager
- [ ] Usage statistics

### Phase 4: Advanced Features
- [ ] Rate limit customization
- [ ] Analytics dashboard
- [ ] Webhook testing tool
- [ ] API key rotation scheduler
- [ ] Activity timeline

---

**Cập nhật lần cuối**: 18/06/2026  
**Tác giả**: Bella ERP Development Team
