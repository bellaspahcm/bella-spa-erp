import {
  ComplaintTicketAggregate,
  ComplaintTicketProps,
  TicketPriority,
  TicketCategory,
  TicketState,
  TicketEvent,
} from '../domain/ComplaintTicketAggregate';
import { activityStream } from '@/platform/activity-stream/index';
import { TransitionContext } from '@/platform/state-machine/state-machine';

// In-memory data store for demonstration
const MOCK_TICKETS: ComplaintTicketProps[] = [
  {
    id: 'tick-1',
    tenantId: 'real_estate',
    ticketNumber: 'TK-2026-0001',
    customerId: 'inv-1',
    customerName: 'Lê Văn C',
    subject: 'Trễ hạn nộp hồ sơ xin cấp sổ hồng căn CH001',
    description: 'Khách hàng phản ánh căn hộ CH001 đã bàn giao 6 tháng nhưng chưa nhận được thông báo nộp hồ sơ cấp sổ.',
    priority: 'HIGH',
    category: 'SERVICE_QUALITY',
    state: 'INVESTIGATING',
    assignedAgentId: 'agent-1',
    assignedAgentName: 'Trần Thị Hỗ Trợ',
    createdAt: '2026-07-28T09:00:00Z',
    updatedAt: '2026-07-28T10:30:00Z',
  },
  {
    id: 'tick-2',
    tenantId: 'real_estate',
    ticketNumber: 'TK-2026-0002',
    customerId: 'inv-2',
    customerName: 'Phạm Thị D',
    subject: 'Sai lệch số tiền tính lãi chậm thanh toán đợt 3',
    description: 'Khách hàng phản ánh hệ thống tính sai số ngày chậm thanh toán dẫn đến tiền phạt chênh lệch 1,200,000 VND.',
    priority: 'MEDIUM',
    category: 'BILLING',
    state: 'NEW',
    createdAt: '2026-08-01T08:15:00Z',
    updatedAt: '2026-08-01T08:15:00Z',
  },
];

export class ComplaintTicketService {
  private static tickets: Map<string, ComplaintTicketProps> = new Map(
    MOCK_TICKETS.map((t) => [t.id, { ...t }])
  );

  /**
   * Get all tickets for a tenant
   */
  public static getTickets(tenantId: string): ComplaintTicketProps[] {
    return Array.from(this.tickets.values()).filter((t) => t.tenantId === tenantId);
  }

  /**
   * Get a single ticket by ID
   */
  public static getTicketById(id: string): ComplaintTicketProps | undefined {
    return this.tickets.get(id);
  }

  /**
   * Create a new complaint ticket
   */
  public static createTicket(params: {
    tenantId: string;
    customerId: string;
    customerName: string;
    subject: string;
    description: string;
    priority: TicketPriority;
    category: TicketCategory;
    actor: { userId: string; userName: string };
  }): ComplaintTicketProps {
    const ticketId = `tick_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const ticketNumber = `TK-2026-${(this.tickets.size + 1).toString().padStart(4, '0')}`;
    const now = new Date().toISOString();

    const props: ComplaintTicketProps = {
      id: ticketId,
      tenantId: params.tenantId,
      ticketNumber,
      customerId: params.customerId,
      customerName: params.customerName,
      subject: params.subject,
      description: params.description,
      priority: params.priority,
      category: params.category,
      state: 'NEW',
      createdAt: now,
      updatedAt: now,
    };

    this.tickets.set(ticketId, props);

    // Record activity stream event
    activityStream.log({
      tenantId: params.tenantId,
      actor: { userId: params.actor.userId, userName: params.actor.userName },
      verb: 'created',
      object: { type: 'complaint_ticket', id: ticketId, label: ticketNumber },
      target: { type: 'customer', id: params.customerId, label: params.customerName },
      summary: `${params.actor.userName} đã tạo phiếu khiếu nại ${ticketNumber} cho khách hàng ${params.customerName}`,
      category: 'support',
      metadata: {
        subject: params.subject,
        priority: params.priority,
        category: params.category,
      },
    });

    return props;
  }

  /**
   * Helper to execute a state transition on a ticket
   */
  private static async executeTransition(
    ticketId: string,
    event: TicketEvent,
    context: TransitionContext
  ): Promise<ComplaintTicketProps> {
    const props = this.tickets.get(ticketId);
    if (!props) throw new Error(`Ticket "${ticketId}" not found`);

    const aggregate = new ComplaintTicketAggregate(props);
    const oldState = aggregate.state;

    // Run transition on FSM aggregate
    await aggregate.transition(event, context);

    // Save back updated properties
    const updatedProps: ComplaintTicketProps = {
      ...props,
      state: aggregate.state,
      assignedAgentId: aggregate.assignedAgentId,
      assignedAgentName: aggregate.assignedAgentName,
      resolutionNotes: aggregate.resolutionNotes,
      updatedAt: aggregate.updatedAt,
    };

    this.tickets.set(ticketId, updatedProps);

    // Record timeline activity event
    activityStream.log({
      tenantId: props.tenantId,
      actor: { userId: context.actor.userId, userName: context.actor.userName || 'System' },
      verb: 'transitioned',
      object: { type: 'complaint_ticket', id: ticketId, label: props.ticketNumber },
      target: { type: 'customer', id: props.customerId, label: props.customerName },
      summary: `${context.actor.userName || 'Hệ thống'} đã cập nhật trạng thái phiếu ${props.ticketNumber} từ ${oldState} sang ${aggregate.state}`,
      category: 'support',
      correlationId: context.correlationId,
      metadata: {
        event,
        fromState: oldState,
        toState: aggregate.state,
        ...(context.payload ?? {}),
      },
    });

    return updatedProps;
  }

  /**
   * Assign a ticket to a support agent
   */
  public static async assignTicket(
    ticketId: string,
    agentId: string,
    agentName: string,
    actor: { userId: string; userName: string }
  ): Promise<ComplaintTicketProps> {
    const context: TransitionContext = {
      tenantId: 'real_estate',
      correlationId: `corr_${Date.now().toString(36)}`,
      actor,
      payload: { assignedAgentId: agentId, assignedAgentName: agentName },
    };
    return this.executeTransition(ticketId, 'ASSIGN', context);
  }

  /**
   * Start investigating a ticket
   */
  public static async investigateTicket(
    ticketId: string,
    actor: { userId: string; userName: string }
  ): Promise<ComplaintTicketProps> {
    const context: TransitionContext = {
      tenantId: 'real_estate',
      correlationId: `corr_${Date.now().toString(36)}`,
      actor,
    };
    return this.executeTransition(ticketId, 'INVESTIGATE', context);
  }

  /**
   * Resolve a ticket
   */
  public static async resolveTicket(
    ticketId: string,
    resolutionNotes: string,
    actor: { userId: string; userName: string }
  ): Promise<ComplaintTicketProps> {
    const context: TransitionContext = {
      tenantId: 'real_estate',
      correlationId: `corr_${Date.now().toString(36)}`,
      actor,
      payload: { resolutionNotes },
    };
    return this.executeTransition(ticketId, 'RESOLVE', context);
  }

  /**
   * Close a ticket
   */
  public static async closeTicket(
    ticketId: string,
    actor: { userId: string; userName: string }
  ): Promise<ComplaintTicketProps> {
    const context: TransitionContext = {
      tenantId: 'real_estate',
      correlationId: `corr_${Date.now().toString(36)}`,
      actor,
    };
    return this.executeTransition(ticketId, 'CLOSE', context);
  }

  /**
   * Reopen a ticket
   */
  public static async reopenTicket(
    ticketId: string,
    actor: { userId: string; userName: string }
  ): Promise<ComplaintTicketProps> {
    const context: TransitionContext = {
      tenantId: 'real_estate',
      correlationId: `corr_${Date.now().toString(36)}`,
      actor,
    };
    return this.executeTransition(ticketId, 'REOPEN', context);
  }

  /**
   * Cancel a ticket
   */
  public static async cancelTicket(
    ticketId: string,
    actor: { userId: string; userName: string }
  ): Promise<ComplaintTicketProps> {
    const context: TransitionContext = {
      tenantId: 'real_estate',
      correlationId: `corr_${Date.now().toString(36)}`,
      actor,
    };
    return this.executeTransition(ticketId, 'CANCEL', context);
  }

  /**
   * Get Customer Support (CSKH) timeline.
   * Merges all activities related to this customer:
   * - Lead creations/interactions
   * - Property booking, deposit, contracts
   * - Support tickets creations and transitions
   */
  public static getCustomerTimeline(tenantId: string, customerId: string): any[] {
    // 1. Log some mock pre-existing interactions if timeline is empty to make it look great!
    const timelineEvents = activityStream.getStream({
      tenantId,
      limit: 100,
    });

    // Filter events related to this customer (either as object or target)
    const customerEvents = timelineEvents.filter(
      (e) =>
        (e.object.type === 'customer' && e.object.id === customerId) ||
        (e.target?.type === 'customer' && e.target?.id === customerId)
    );

    // If no events exist yet for this customer, inject some beautifully styled mock historical events
    if (customerEvents.length === 0) {
      const mockHistorical = [
        {
          id: 'hist-1',
          tenantId,
          actor: { userId: 'sales-1', userName: 'Nguyễn Văn Kinh Doanh' },
          verb: 'created',
          object: { type: 'lead', id: 'lead-1', label: 'Lead Đầu Tư' },
          target: { type: 'customer', id: customerId, label: 'Lê Văn C' },
          summary: 'Nguyễn Văn Kinh Doanh đã tạo Lead mới cho Lê Văn C từ nguồn Website',
          category: 'crm',
          timestamp: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(), // 30 days ago
        },
        {
          id: 'hist-2',
          tenantId,
          actor: { userId: 'sales-1', userName: 'Nguyễn Văn Kinh Doanh' },
          verb: 'contacted',
          object: { type: 'customer', id: customerId, label: 'Lê Văn C' },
          summary: 'Đã gọi điện tư vấn dự án Grand Tower. Khách quan tâm căn 2 phòng ngủ hướng Đông Nam.',
          category: 'crm',
          timestamp: new Date(Date.now() - 28 * 24 * 3600 * 1000).toISOString(),
        },
        {
          id: 'hist-3',
          tenantId,
          actor: { userId: 'sales-1', userName: 'Nguyễn Văn Kinh Doanh' },
          verb: 'completed',
          object: { type: 'site_visit', id: 'visit-1', label: 'Xem Nhà Mẫu Grand Tower' },
          target: { type: 'customer', id: customerId, label: 'Lê Văn C' },
          summary: 'Khách hàng đã tham quan nhà mẫu và hài lòng với thiết kế bàn giao.',
          category: 'crm',
          timestamp: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(),
        },
        {
          id: 'hist-4',
          tenantId,
          actor: { userId: 'sales-1', userName: 'Nguyễn Văn Kinh Doanh' },
          verb: 'created',
          object: { type: 'booking', id: 'book-1', label: 'CH-1204' },
          target: { type: 'customer', id: customerId, label: 'Lê Văn C' },
          summary: 'Khách hàng đã ký phiếu giữ chỗ và thanh toán 50,000,000 VND giữ chỗ căn CH-1204',
          category: 'sales',
          timestamp: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
        },
        {
          id: 'hist-5',
          tenantId,
          actor: { userId: 'system', userName: 'Hệ thống' },
          verb: 'signed',
          object: { type: 'contract', id: 'contr-1', label: 'HĐMB-Grand-1204' },
          target: { type: 'customer', id: customerId, label: 'Lê Văn C' },
          summary: 'Ký kết thành công Hợp đồng Mua bán HĐMB-Grand-1204 cho căn CH-1204',
          category: 'sales',
          timestamp: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
        },
      ];

      return mockHistorical;
    }

    return customerEvents;
  }
}
