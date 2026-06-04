import {
  countUnreadStaffMessages,
  markStaffMessagesReadLocally,
  mergePortalMessage,
  removePortalMessage,
  replacePortalMessage,
  sortPortalMessages,
  type PortalChatMessage,
} from '@/components/features/portal/portal-chat-utils';

function message(overrides: Partial<PortalChatMessage>): PortalChatMessage {
  return {
    created_at: '2026-06-04T08:00:00.000Z',
    customer_id: 'cust-1',
    id: 'msg-1',
    is_read: false,
    message: 'Default message',
    sender_id: null,
    sender_type: 'staff',
    tenant_id: 'tenant-1',
    ...overrides,
  };
}

describe('portal chat realtime helpers', () => {
  it('sorts portal messages chronologically', () => {
    const sorted = sortPortalMessages([
      message({ id: 'msg-2', created_at: '2026-06-04T09:00:00.000Z' }),
      message({ id: 'msg-1', created_at: '2026-06-04T08:00:00.000Z' }),
    ]);

    expect(sorted.map((item) => item.id)).toEqual(['msg-1', 'msg-2']);
  });

  it('merges a realtime insert once and keeps the latest row by id', () => {
    const existing = message({ id: 'msg-1', message: 'Old text', is_read: false });
    const updated = message({ id: 'msg-1', message: 'Updated text', is_read: true });

    expect(mergePortalMessage([existing], updated)).toEqual([
      expect.objectContaining({ id: 'msg-1', message: 'Updated text', is_read: true }),
    ]);
  });

  it('appends new realtime messages in chronological order', () => {
    const merged = mergePortalMessage(
      [message({ id: 'msg-2', created_at: '2026-06-04T09:00:00.000Z' })],
      message({ id: 'msg-1', created_at: '2026-06-04T08:00:00.000Z' })
    );

    expect(merged.map((item) => item.id)).toEqual(['msg-1', 'msg-2']);
  });

  it('replaces matching optimistic customer message with the persisted row', () => {
    const optimistic = message({
      id: 'tmp-1',
      isOptimistic: true,
      message: 'Xin tu van',
      sender_type: 'customer',
      tenant_id: null,
      customer_id: null,
    });
    const saved = message({
      id: 'msg-saved',
      message: 'Xin tu van',
      sender_type: 'customer',
    });

    const merged = mergePortalMessage([optimistic], saved);

    expect(merged).toEqual([
      expect.objectContaining({
        id: 'msg-saved',
        message: 'Xin tu van',
      }),
    ]);
    expect(merged[0]).not.toHaveProperty('isOptimistic');
  });

  it('replaces and removes explicit temporary messages', () => {
    const optimistic = message({ id: 'tmp-1', isOptimistic: true });
    const saved = message({ id: 'msg-saved', message: 'Saved' });

    expect(replacePortalMessage([optimistic], 'tmp-1', saved)).toEqual([
      expect.objectContaining({ id: 'msg-saved', message: 'Saved' }),
    ]);
    expect(removePortalMessage([optimistic], 'tmp-1')).toEqual([]);
  });

  it('counts only unread staff messages and can mark them read locally', () => {
    const messages = [
      message({ id: 'staff-unread', sender_type: 'staff', is_read: false }),
      message({ id: 'staff-read', sender_type: 'staff', is_read: true }),
      message({ id: 'customer-unread', sender_type: 'customer', is_read: false }),
    ];

    expect(countUnreadStaffMessages(messages)).toBe(1);

    const marked = markStaffMessagesReadLocally(messages);
    expect(countUnreadStaffMessages(marked)).toBe(0);
    expect(marked.find((item) => item.id === 'customer-unread')).toEqual(
      expect.objectContaining({ is_read: false })
    );
  });
});
