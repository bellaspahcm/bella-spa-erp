// ============================================================================
// BELLA PRESCHOOL OS: P7.2 FINANCE PROJECTION BRIDGE
// File: src/products/bella-education/parent-engagement/bridges/finance-projection.bridge.ts
// ============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import { CommunicationDeliveryService } from '../services/communication-delivery.service';
import { ParentCommunicationRepository } from '../repositories/parent-communication.repository';
import { CommunicationNotice, CommunicationDelivery, P6_ERROR_CODES } from '../domain/communication.types';

export interface IProjectIssuedInvoiceDto {
  tenantId: string;
  studentId: string;
  guardianPartyIds: string[];
  invoiceId: string;
  invoiceNumber: string;
  netAmount: number;
  dueDate: string;
  invoiceStatus: 'DRAFT' | 'ISSUED' | 'VOID';
  createdBy: string;
}

export class FinanceProjectionBridge {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly deliveryService: CommunicationDeliveryService,
    private readonly repository: ParentCommunicationRepository
  ) {}

  /**
   * Projects an ISSUED invoice payload into Parent Communication Notices (P6)
   */
  async projectIssuedInvoice(dto: IProjectIssuedInvoiceDto): Promise<{
    isDuplicate: boolean;
    notice: CommunicationNotice;
    deliveries: CommunicationDelivery[];
  }> {
    // Defense-in-Depth Safety Guard: Strictly reject DRAFT or VOID invoices
    if (dto.invoiceStatus !== 'ISSUED') {
      throw new Error(`UNISSUED_INVOICE_PROJECTION_ERROR: Cannot project DRAFT or VOID invoice into parent communications.`);
    }

    // 1. Idempotency Check
    const { data: existingNotice } = await this.supabase
      .from('edu_comm_notices')
      .select('*')
      .eq('tenant_id', dto.tenantId)
      .eq('source_domain', 'P7_FINANCE')
      .eq('source_entity_type', 'INVOICE')
      .eq('source_entity_id', dto.invoiceId)
      .eq('is_archived', false)
      .maybeSingle();

    if (existingNotice) {
      const { data: deliveries } = await this.supabase
        .from('edu_comm_deliveries')
        .select('*')
        .eq('notice_id', existingNotice.id)
        .eq('tenant_id', dto.tenantId);

      return {
        isDuplicate: true,
        notice: existingNotice as CommunicationNotice,
        deliveries: (deliveries || []) as CommunicationDelivery[],
      };
    }

    // 2. Student Belonging Verification
    const { data: student } = await this.supabase
      .from('students')
      .select('student_id, tenant_id')
      .eq('student_id', dto.studentId)
      .eq('tenant_id', dto.tenantId)
      .maybeSingle();

    if (!student) {
      throw new Error(`${P6_ERROR_CODES.TENANT_MISMATCH}: Student ${dto.studentId} does not belong to tenant ${dto.tenantId}.`);
    }

    // 3. Create Thread using Primary Guardian
    const primaryGuardian = dto.guardianPartyIds[0];
    const thread = await this.deliveryService.createThread({
      tenantId: dto.tenantId,
      studentId: dto.studentId,
      guardianPartyId: primaryGuardian,
      threadType: 'GENERAL',
      title: `Thông báo học phí: Hóa đơn ${dto.invoiceNumber}`,
      createdBy: dto.createdBy,
    });

    // 4. Policy Mapping: Issued Invoice -> REQUIRES_ACK with Due Date
    const res = await this.deliveryService.createNotice({
      tenantId: dto.tenantId,
      threadId: thread.id,
      sourceDomain: 'P7_FINANCE',
      sourceEntityType: 'INVOICE',
      sourceEntityId: dto.invoiceId,
      noticeCategory: 'INFO',
      priority: 'HIGH',
      requirementType: 'REQUIRES_ACK',
      title: `Thông báo học phí & Phí dịch vụ: Hóa đơn ${dto.invoiceNumber}`,
      bodyText: `Kính gửi Phụ huynh, tổng số tiền cần thanh toán cho kỳ học là ${dto.netAmount.toLocaleString('vi-VN')} VNĐ. Hạn chót thanh toán: ${dto.dueDate}.`,
      metadata: {
        invoiceNumber: dto.invoiceNumber,
        netAmount: dto.netAmount,
        dueDate: dto.dueDate,
      },
      dueAt: new Date(dto.dueDate).toISOString(),
      createdBy: dto.createdBy,
      recipientPartyIds: dto.guardianPartyIds,
    });

    return {
      isDuplicate: false,
      notice: res.notice,
      deliveries: res.deliveries,
    };
  }
}
