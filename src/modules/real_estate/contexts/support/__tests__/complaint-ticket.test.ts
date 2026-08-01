import { ComplaintTicketService } from '../application/ComplaintTicketService';
import { ComplaintTicketAggregate } from '../domain/ComplaintTicketAggregate';
import { activityStream } from '@/platform';

describe('Support Bounded Context — Complaint Tickets & Timeline', () => {
  const actor = { userId: 'user-test', userName: 'Test Operator' };

  beforeEach(() => {
    // Clear platform activity stream ring buffers before each test
    activityStream.clearTenant('real_estate');
  });

  it('should successfully create a new complaint ticket and record the creation activity', () => {
    const ticket = ComplaintTicketService.createTicket({
      tenantId: 'real_estate',
      customerId: 'cust-123',
      customerName: 'Nguyễn Văn A',
      subject: 'Nứt tường phòng khách',
      description: 'Phòng khách có vết nứt dài 2m ở bức tường phía Tây.',
      priority: 'HIGH',
      category: 'TECHNICAL',
      actor,
    });

    expect(ticket.id).toBeDefined();
    expect(ticket.ticketNumber).toBeDefined();
    expect(ticket.state).toBe('NEW');
    expect(ticket.priority).toBe('HIGH');
    expect(ticket.category).toBe('TECHNICAL');

    // Rule #2: Assert Side-Effect (Verify activity stream entry)
    const stream = activityStream.getStream({ tenantId: 'real_estate' });
    expect(stream.length).toBe(1);
    expect(stream[0].verb).toBe('created');
    expect(stream[0].object.type).toBe('complaint_ticket');
    expect(stream[0].object.id).toBe(ticket.id);
    expect(stream[0].target?.type).toBe('customer');
    expect(stream[0].target?.id).toBe('cust-123');
    expect(stream[0].category).toBe('support');
  });

  it('should transition through valid FSM states and record transition activities', async () => {
    const ticket = ComplaintTicketService.createTicket({
      tenantId: 'real_estate',
      customerId: 'cust-123',
      customerName: 'Nguyễn Văn A',
      subject: 'Sai số tiền hóa đơn',
      description: 'Hóa đơn tính thừa 500,000 VND',
      priority: 'MEDIUM',
      category: 'BILLING',
      actor,
    });

    // 1. Assign Ticket
    const assigned = await ComplaintTicketService.assignTicket(ticket.id, 'agent-123', 'Nguyễn Thị B', actor);
    expect(assigned.state).toBe('ASSIGNED');
    expect(assigned.assignedAgentId).toBe('agent-123');
    expect(assigned.assignedAgentName).toBe('Nguyễn Thị B');

    // Verify side effect
    let stream = activityStream.getStream({ tenantId: 'real_estate' });
    expect(stream.find(e => e.metadata?.event === 'ASSIGN')).toBeDefined();

    // 2. Start Investigating
    const investigating = await ComplaintTicketService.investigateTicket(ticket.id, actor);
    expect(investigating.state).toBe('INVESTIGATING');

    // Verify side effect
    stream = activityStream.getStream({ tenantId: 'real_estate' });
    expect(stream.find(e => e.metadata?.event === 'INVESTIGATE')).toBeDefined();

    // 3. Resolve Ticket
    const resolved = await ComplaintTicketService.resolveTicket(ticket.id, 'Đã hoàn trả 500k qua chuyển khoản', actor);
    expect(resolved.state).toBe('RESOLVED');
    expect(resolved.resolutionNotes).toBe('Đã hoàn trả 500k qua chuyển khoản');

    // Verify side effect
    stream = activityStream.getStream({ tenantId: 'real_estate' });
    const resolveActivity = stream.find(e => e.metadata?.event === 'RESOLVE');
    expect(resolveActivity).toBeDefined();
    expect(resolveActivity?.metadata?.resolutionNotes).toBe('Đã hoàn trả 500k qua chuyển khoản');

    // 4. Close Ticket
    const closed = await ComplaintTicketService.closeTicket(ticket.id, actor);
    expect(closed.state).toBe('CLOSED');

    // Verify side effect
    stream = activityStream.getStream({ tenantId: 'real_estate' });
    expect(stream.find(e => e.metadata?.event === 'CLOSE')).toBeDefined();
  });

  it('should block invalid transitions on the FSM', async () => {
    const ticket = ComplaintTicketService.createTicket({
      tenantId: 'real_estate',
      customerId: 'cust-123',
      customerName: 'Nguyễn Văn A',
      subject: 'Lỗi khóa cửa thông minh',
      description: 'Khóa cửa không nhận vân tay',
      priority: 'HIGH',
      category: 'TECHNICAL',
      actor,
    });

    // Attempting to resolve directly from NEW must throw error
    await expect(async () => {
      await ComplaintTicketService.resolveTicket(ticket.id, 'Đã đổi pin khóa', actor);
    }).rejects.toThrow(/Invalid transition/);

    // Verify no transition activity was written
    const stream = activityStream.getStream({ tenantId: 'real_estate' });
    expect(stream.length).toBe(1); // Only the "created" activity
  });
});
