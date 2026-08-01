/**
 * @fileoverview Platform Document Engine
 *
 * Generates structured business documents from templates.
 * Supports contracts, invoices, receipts, reports across all verticals.
 *
 * NEW: Document Lifecycle FSM
 *   Draft → Review → Approved → Signed → [Rejected | Cancelled | Expired]
 *
 * NEW: Digital Signature Schema Bindings
 *   - SignatureField definition (who must sign, in what order)
 *   - SignatureRecord (actual signed/rejected stamp)
 *   - SignatureRequest (multi-party signing session)
 *
 * @module platform/document-engine
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types — Document
// ─────────────────────────────────────────────────────────────────────────────

export type DocumentFormat = 'html' | 'markdown' | 'text' | 'pdf_ready';

export type DocumentCategory =
  | 'contract'           // HĐMB, HĐDV
  | 'invoice'            // Hóa đơn VAT, phiếu thu
  | 'receipt'            // Biên lai thanh toán
  | 'report'             // Báo cáo định kỳ
  | 'payslip'            // Phiếu lương
  | 'notice'             // Thông báo pháp lý
  | 'certificate'        // Chứng nhận
  | 'handover'           // Biên bản bàn giao
  | 'other';

// ─────────────────────────────────────────────────────────────────────────────
// Types — Document Lifecycle FSM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Document states in the standard legal document lifecycle.
 *
 * Draft → Review → Approved → Signed
 *               ↘ Rejected
 * Draft | Review → Cancelled
 * Approved | Signed → Expired
 */
export type DocumentLifecycleState =
  | 'draft'       // Đang soạn thảo
  | 'review'      // Đang xem xét/phê duyệt
  | 'approved'    // Đã phê duyệt, chờ ký
  | 'signed'      // Đã ký đầy đủ — pháp lý hoàn chỉnh
  | 'rejected'    // Bị từ chối
  | 'cancelled'   // Hủy bỏ (trước khi ký)
  | 'expired';    // Hết hiệu lực

export type DocumentLifecycleEvent =
  | 'SUBMIT_FOR_REVIEW'   // draft → review
  | 'APPROVE'             // review → approved
  | 'REJECT'              // review → rejected
  | 'SIGN'                // approved → signed (all parties signed)
  | 'CANCEL'              // draft | review → cancelled
  | 'EXPIRE';             // approved | signed → expired

export interface DocumentLifecycleTransition {
  from: DocumentLifecycleState | DocumentLifecycleState[];
  event: DocumentLifecycleEvent;
  to: DocumentLifecycleState;
}

const DOCUMENT_TRANSITIONS: DocumentLifecycleTransition[] = [
  { from: 'draft',                    event: 'SUBMIT_FOR_REVIEW', to: 'review' },
  { from: 'review',                   event: 'APPROVE',           to: 'approved' },
  { from: 'review',                   event: 'REJECT',            to: 'rejected' },
  { from: 'approved',                 event: 'SIGN',              to: 'signed' },
  { from: ['draft', 'review'],        event: 'CANCEL',            to: 'cancelled' },
  { from: ['approved', 'signed'],     event: 'EXPIRE',            to: 'expired' },
];

/** Validate a lifecycle transition. Returns `null` if valid, error message if not. */
export function validateDocumentTransition(
  current: DocumentLifecycleState,
  event: DocumentLifecycleEvent
): { valid: boolean; nextState?: DocumentLifecycleState; error?: string } {
  const match = DOCUMENT_TRANSITIONS.find((t) => {
    const froms = Array.isArray(t.from) ? t.from : [t.from];
    return froms.includes(current) && t.event === event;
  });

  if (!match) {
    return {
      valid: false,
      error: `Invalid transition: cannot apply event "${event}" to document in state "${current}"`,
    };
  }

  return { valid: true, nextState: match.to };
}

/** Terminal states that can never transition further */
export const TERMINAL_DOCUMENT_STATES: DocumentLifecycleState[] = [
  'signed', 'rejected', 'cancelled', 'expired',
];

export function isDocumentTerminal(state: DocumentLifecycleState): boolean {
  return TERMINAL_DOCUMENT_STATES.includes(state);
}

// ─────────────────────────────────────────────────────────────────────────────
// Types — Digital Signature Schema
// ─────────────────────────────────────────────────────────────────────────────

export type SignatureRole =
  | 'seller'          // Bên bán
  | 'buyer'           // Bên mua / khách hàng
  | 'witness'         // Người chứng kiến
  | 'notary'          // Công chứng viên
  | 'agent'           // Môi giới / đại lý
  | 'manager'         // Quản lý nội bộ
  | 'legal_rep'       // Đại diện pháp lý
  | string;

export type SignatureMethod =
  | 'electronic'      // Chữ ký điện tử (OTP, click-to-sign)
  | 'qualified'       // Chữ ký số có chứng thư (PKI/CA)
  | 'wet'             // Chữ ký tay (uploaded scan)
  | 'biometric';      // Vân tay/FaceID

export type SignatureStatus =
  | 'pending'         // Chưa ký
  | 'signed'          // Đã ký
  | 'rejected'        // Từ chối ký
  | 'expired';        // Hết hạn ký

/**
 * Definition of WHO must sign a document, in what order and role.
 * Defined at template level (describes requirements).
 */
export interface SignatureField {
  /** Unique field identifier (e.g. 'buyer_signature_1') */
  fieldId: string;
  /** Display label (e.g. 'Chữ ký Bên Mua') */
  label: string;
  /** Who must sign */
  role: SignatureRole;
  /** Signing method required */
  method: SignatureMethod;
  /** Page number in PDF (1-indexed), null = last page */
  page?: number;
  /** X/Y position in % of page dimensions (0–100) */
  x?: number;
  y?: number;
  /** Signing order — lower = sign first (for sequential workflows) */
  order: number;
  /** If false, this signature is optional */
  required: boolean;
  /** ISO: deadline to sign by */
  deadline?: string;
}

/**
 * Actual signature stamp — recorded when a party signs.
 */
export interface SignatureRecord {
  fieldId: string;
  role: SignatureRole;
  /** User who signed */
  signerUserId: string;
  signerName: string;
  status: SignatureStatus;
  method: SignatureMethod;
  /** ISO: when signed/rejected */
  signedAt?: string;
  /** Cryptographic signature hash (for qualified/electronic) */
  signatureHash?: string;
  /** MIME type of evidence file (for wet ink) */
  evidenceMimeType?: string;
  /** URL/path to evidence file */
  evidenceUrl?: string;
  /** Reason for rejection (if rejected) */
  rejectionReason?: string;
  /** IP address of signer */
  ipAddress?: string;
  /** Device fingerprint */
  userAgent?: string;
}

/**
 * A complete multi-party signing session for a document.
 * Tracks all required signature fields and their actual records.
 */
export interface SignatureRequest {
  requestId: string;
  documentId: string;
  tenantId: string;
  /** The signing fields required (from template definition) */
  fields: SignatureField[];
  /** Actual signatures recorded so far */
  records: SignatureRecord[];
  status: 'pending' | 'completed' | 'expired' | 'voided';
  /** ISO: when request was created */
  createdAt: string;
  /** ISO: overall deadline */
  expiresAt?: string;
  /** ISO: when all required parties signed */
  completedAt?: string;
  /** Notes from coordinator */
  notes?: string;
}

/**
 * Check if all required signature fields have been signed.
 */
export function isSignatureRequestComplete(req: SignatureRequest): boolean {
  const requiredFields = req.fields.filter((f) => f.required);
  return requiredFields.every((field) => {
    const record = req.records.find((r) => r.fieldId === field.fieldId);
    return record?.status === 'signed';
  });
}

/**
 * Get next pending signature field(s) based on order.
 */
export function getNextPendingSignatureFields(req: SignatureRequest): SignatureField[] {
  const signedFieldIds = new Set(
    req.records.filter((r) => r.status === 'signed').map((r) => r.fieldId)
  );
  const pending = req.fields
    .filter((f) => f.required && !signedFieldIds.has(f.fieldId))
    .sort((a, b) => a.order - b.order);

  if (pending.length === 0) return [];

  // Return all fields with the same lowest order (parallel signing allowed)
  const lowestOrder = pending[0].order;
  return pending.filter((f) => f.order === lowestOrder);
}

// ─────────────────────────────────────────────────────────────────────────────
// Template Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DocumentTemplate {
  /** Unique key (e.g. 'real_estate.purchase_contract.v1') */
  key: string;
  name: string;
  category: DocumentCategory;
  format: DocumentFormat;
  version: string;
  /** Template body — supports {{variable}} interpolation */
  body: string;
  /** Optional CSS styles for html format */
  styles?: string;
  /** Tenant-specific override */
  tenantId?: string | null;
  /** Legal jurisdiction / compliance note */
  jurisdiction?: string;
  /**
   * NEW: Digital signature field definitions for this template.
   * Documents generated from this template will inherit these fields
   * when a SignatureRequest is created.
   */
  signatureFields?: SignatureField[];
  /** Default lifecycle state for documents generated from this template */
  defaultLifecycleState?: DocumentLifecycleState;
}

export interface DocumentMetadata {
  documentId: string;
  templateKey: string;
  templateVersion: string;
  category: DocumentCategory;
  format: DocumentFormat;
  tenantId: string;
  generatedAt: string;
  generatedBy: string;
  /** Arbitrary business reference (contractId, invoiceId, etc.) */
  referenceId?: string;
  referenceType?: string;
  /** Whether this document has legal standing */
  isLegal?: boolean;
  /** Current lifecycle state */
  lifecycleState: DocumentLifecycleState;
}

export interface DocumentOutput {
  metadata: DocumentMetadata;
  content: string;
  /** Subject/title of the document */
  title: string;
  format: DocumentFormat;
  /**
   * NEW: Signature fields inherited from template.
   * Populated when template has signatureFields defined.
   */
  signatureFields?: SignatureField[];
}

export interface DocumentGenerationOptions {
  tenantId: string;
  generatedBy: string;
  referenceId?: string;
  referenceType?: string;
  isLegal?: boolean;
  /** Override default lifecycle state */
  initialLifecycleState?: DocumentLifecycleState;
}

// ─────────────────────────────────────────────────────────────────────────────
// Interpolation
// ─────────────────────────────────────────────────────────────────────────────

function resolveValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc !== null && typeof acc === 'object' && !Array.isArray(acc)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function interpolate(template: string, data: Record<string, unknown>): string {
  let result = template.replace(
    /\{\{#if\s+(\S+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_m, key, block) => (resolveValue(data, key) ? interpolate(block, data) : '')
  );
  result = result.replace(/\{\{(\S+?)\}\}/g, (_m, key) => {
    const val = resolveValue(data, key);
    if (val === null || val === undefined) return '';
    return String(val);
  });
  return result;
}

function generateDocId(): string {
  return `doc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

function generateRequestId(): string {
  return `sigreq_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Document Engine
// ─────────────────────────────────────────────────────────────────────────────

class DocumentEngineClass {
  private readonly registry = new Map<string, DocumentTemplate>();
  private readonly tenantOverrides = new Map<string, DocumentTemplate>();

  // ── Template Management ───────────────────────────────────────────────────

  /** Register a document template */
  registerTemplate(template: DocumentTemplate): void {
    if (template.tenantId) {
      this.tenantOverrides.set(`${template.tenantId}:${template.key}`, template);
    } else {
      this.registry.set(template.key, template);
    }
  }

  /** Resolve template: tenant override first, then platform default */
  getTemplate(key: string, tenantId?: string): DocumentTemplate | undefined {
    if (tenantId) {
      const override = this.tenantOverrides.get(`${tenantId}:${key}`);
      if (override) return override;
    }
    return this.registry.get(key);
  }

  /** List all registered template keys */
  listTemplates(tenantId?: string): DocumentTemplate[] {
    const all = Array.from(this.registry.values());
    if (tenantId) {
      for (const [k, v] of this.tenantOverrides) {
        if (k.startsWith(`${tenantId}:`)) all.push(v);
      }
    }
    return all;
  }

  // ── Document Generation ───────────────────────────────────────────────────

  /**
   * Generate a document from a registered template + data.
   * @throws if template not found
   */
  generate(
    templateKey: string,
    data: Record<string, unknown>,
    options: DocumentGenerationOptions
  ): DocumentOutput {
    const template = this.getTemplate(templateKey, options.tenantId);
    if (!template) {
      throw new Error(`[DocumentEngine] Template not found: "${templateKey}"`);
    }

    const mergedData = { ...data, generatedAt: new Date().toISOString(), tenantId: options.tenantId };
    const content = interpolate(template.body, mergedData);
    const title = interpolate(template.name, mergedData);

    const metadata: DocumentMetadata = {
      documentId: generateDocId(),
      templateKey,
      templateVersion: template.version,
      category: template.category,
      format: template.format,
      tenantId: options.tenantId,
      generatedAt: mergedData.generatedAt as string,
      generatedBy: options.generatedBy,
      referenceId: options.referenceId,
      referenceType: options.referenceType,
      isLegal: options.isLegal ?? false,
      lifecycleState: options.initialLifecycleState ?? template.defaultLifecycleState ?? 'draft',
    };

    return {
      metadata,
      content,
      title,
      format: template.format,
      signatureFields: template.signatureFields,
    };
  }

  /**
   * Generate from inline template body (no registry lookup).
   */
  generateInline(
    body: string,
    data: Record<string, unknown>,
    options: DocumentGenerationOptions & {
      title?: string;
      category?: DocumentCategory;
      format?: DocumentFormat;
      signatureFields?: SignatureField[];
    }
  ): DocumentOutput {
    const mergedData = { ...data, generatedAt: new Date().toISOString() };
    const content = interpolate(body, mergedData);
    const metadata: DocumentMetadata = {
      documentId: generateDocId(),
      templateKey: '_inline_',
      templateVersion: '1.0.0',
      category: options.category ?? 'other',
      format: options.format ?? 'text',
      tenantId: options.tenantId,
      generatedAt: mergedData.generatedAt as string,
      generatedBy: options.generatedBy,
      referenceId: options.referenceId,
      referenceType: options.referenceType,
      isLegal: options.isLegal ?? false,
      lifecycleState: options.initialLifecycleState ?? 'draft',
    };

    return {
      metadata,
      content,
      title: options.title ?? 'Document',
      format: options.format ?? 'text',
      signatureFields: options.signatureFields,
    };
  }

  // ── Digital Signature Request Management ─────────────────────────────────

  /**
   * Create a SignatureRequest from a generated document.
   * Inherits signature fields from the document (from template).
   */
  createSignatureRequest(params: {
    documentOutput: DocumentOutput;
    expiresAt?: string;
    notes?: string;
  }): SignatureRequest {
    const { documentOutput, expiresAt, notes } = params;
    const fields = documentOutput.signatureFields ?? [];

    return {
      requestId: generateRequestId(),
      documentId: documentOutput.metadata.documentId,
      tenantId: documentOutput.metadata.tenantId,
      fields,
      records: [],
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt,
      notes,
    };
  }

  /**
   * Record a signature on an existing SignatureRequest.
   * Returns updated request with the new record applied.
   *
   * Automatically marks request as 'completed' when all required fields signed.
   */
  recordSignature(
    req: SignatureRequest,
    record: Omit<SignatureRecord, 'signedAt'> & { signedAt?: string }
  ): SignatureRequest {
    if (req.status !== 'pending') {
      throw new Error(
        `[DocumentEngine] Cannot record signature on request "${req.requestId}" — status is "${req.status}"`
      );
    }

    // Check field exists in request
    const field = req.fields.find((f) => f.fieldId === record.fieldId);
    if (!field) {
      throw new Error(
        `[DocumentEngine] Signature field "${record.fieldId}" not found in request "${req.requestId}"`
      );
    }

    // Remove existing record for this field if re-signing
    const filteredRecords = req.records.filter((r) => r.fieldId !== record.fieldId);

    const fullRecord: SignatureRecord = {
      ...record,
      signedAt: record.signedAt ?? new Date().toISOString(),
    };

    const updatedRecords = [...filteredRecords, fullRecord];
    const updatedReq: SignatureRequest = { ...req, records: updatedRecords };

    // Auto-complete if all required fields are signed
    if (isSignatureRequestComplete(updatedReq)) {
      return {
        ...updatedReq,
        status: 'completed',
        completedAt: new Date().toISOString(),
      };
    }

    return updatedReq;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Apply a lifecycle event to a document's current state.
   * Returns the new state, or throws if invalid transition.
   */
  applyLifecycleEvent(
    currentState: DocumentLifecycleState,
    event: DocumentLifecycleEvent
  ): DocumentLifecycleState {
    const result = validateDocumentTransition(currentState, event);
    if (!result.valid || !result.nextState) {
      throw new Error(result.error);
    }
    return result.nextState;
  }
}

export const documentEngine = new DocumentEngineClass();

// ─────────────────────────────────────────────────────────────────────────────
// Built-in Platform Templates
// ─────────────────────────────────────────────────────────────────────────────

documentEngine.registerTemplate({
  key: 'platform.salary_payslip.v1',
  name: 'Phiếu Lương Tháng {{month}}',
  category: 'payslip',
  format: 'html',
  version: '1.0.0',
  defaultLifecycleState: 'approved', // Payslips go straight to approved
  body: `<div class="payslip">
  <h2>PHIẾU LƯƠNG THÁNG {{month}}</h2>
  <p><strong>Nhân viên:</strong> {{employeeName}}</p>
  <p><strong>Chức vụ:</strong> {{position}}</p>
  <table>
    <tr><td>Lương cơ bản</td><td>{{baseSalary}} VND</td></tr>
    <tr><td>Hoa hồng ca</td><td>{{sessionBonus}} VND</td></tr>
    <tr><td>Thưởng KPI</td><td>{{kpiBonus}} VND</td></tr>
    <tr><td>Khấu trừ</td><td>-{{deductions}} VND</td></tr>
    <tr class="total"><td><strong>Tổng lương</strong></td><td><strong>{{totalSalary}} VND</strong></td></tr>
  </table>
  <p>Ngày lập: {{generatedAt}}</p>
</div>`,
});

documentEngine.registerTemplate({
  key: 'real_estate.booking_confirmation.v1',
  name: 'Giấy Xác Nhận Giữ Chỗ Căn {{productCode}}',
  category: 'receipt',
  format: 'html',
  version: '1.0.0',
  jurisdiction: 'VN',
  defaultLifecycleState: 'draft',
  body: `<div class="booking-confirmation">
  <h2>GIẤY XÁC NHẬN GIỮ CHỖ</h2>
  <p>Căn hộ: <strong>{{productCode}}</strong> - Tầng {{floor}} - Diện tích {{area}}m²</p>
  <p>Khách hàng: <strong>{{investorName}}</strong></p>
  <p>Thời hạn giữ chỗ: {{holdDeadline}}</p>
  <p>Phí giữ chỗ: {{bookingFee}} VND</p>
  <p class="note">Giấy này có giá trị trong vòng {{holdHours}} giờ kể từ {{generatedAt}}</p>
</div>`,
});

/** Real estate purchase contract — requires 2 signatures */
documentEngine.registerTemplate({
  key: 'real_estate.purchase_contract.v1',
  name: 'Hợp Đồng Mua Bán Căn {{productCode}}',
  category: 'contract',
  format: 'html',
  version: '1.0.0',
  jurisdiction: 'VN',
  defaultLifecycleState: 'draft',
  signatureFields: [
    {
      fieldId: 'seller_signature',
      label: 'Chữ ký Bên Bán',
      role: 'seller',
      method: 'qualified',
      page: 1,
      x: 20,
      y: 85,
      order: 1,
      required: true,
    },
    {
      fieldId: 'buyer_signature',
      label: 'Chữ ký Bên Mua',
      role: 'buyer',
      method: 'qualified',
      page: 1,
      x: 70,
      y: 85,
      order: 2,
      required: true,
    },
    {
      fieldId: 'witness_signature',
      label: 'Người Chứng Kiến',
      role: 'witness',
      method: 'wet',
      page: 1,
      x: 45,
      y: 92,
      order: 3,
      required: false,
    },
  ],
  body: `<div class="purchase-contract">
  <h1>HỢP ĐỒNG MUA BÁN CĂN HỘ</h1>
  <p><strong>Số hợp đồng:</strong> {{contractNumber}}</p>
  <h2>BÊN BÁN</h2>
  <p>{{sellerName}} — {{sellerTaxCode}}</p>
  <h2>BÊN MUA</h2>
  <p>{{buyerName}} — CMND/CCCD: {{buyerIdNumber}}</p>
  <h2>TÀI SẢN</h2>
  <p>Căn hộ: <strong>{{productCode}}</strong> — Diện tích {{area}}m² — Tầng {{floor}}</p>
  <p>Dự án: {{projectName}}</p>
  <h2>GIÁ TRỊ HỢP ĐỒNG</h2>
  <p>Giá bán: <strong>{{totalPrice}} VND</strong> ({{totalPriceWords}})</p>
  <p>Đã bao gồm VAT: {{vatAmount}} VND</p>
  <h2>ĐIỀU KHOẢN THANH TOÁN</h2>
  <p>{{paymentTerms}}</p>
  <div class="signatures">
    <p><em>Ký ngày: {{generatedAt}}</em></p>
    <div class="sig-block" style="display:flex;justify-content:space-between">
      <div>[CHỮ KÝ BÊN BÁN]</div>
      <div>[CHỮ KÝ BÊN MUA]</div>
    </div>
  </div>
</div>`,
});
