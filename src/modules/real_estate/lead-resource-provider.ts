import {
  resourceRegistry,
  ResourceProviderManifest,
  AssigneeUser,
  ResourceRef,
} from '@/platform/capability-platform';

export const REAL_ESTATE_LEAD_PROVIDER: ResourceProviderManifest = {
  resourceType: 'lead',

  slaMetadata: {
    stages: [
      { stage: 'accept', label: 'Chờ Sale Nhận Lead', timeoutMinutes: 30 },
      { stage: 'followup_1', label: 'Phản Hồi Lần 1', timeoutMinutes: 120 },
      { stage: 'followup_2', label: 'Phản Hồi Lần 2', timeoutMinutes: 1440 },
    ],
    reminderBeforeMinutes: 10,
  },

  workflowMetadata: {
    initialState: 'waiting_accept',
    terminalStates: ['converted', 'lost', 'archived'],
    transitions: [
      { fromState: 'waiting_accept', toState: 'in_progress', actionCode: 'ACCEPT', label: 'Xác Nhận Nhận Lead' },
      { fromState: 'in_progress', toState: 'converted', actionCode: 'BOOKING', label: 'Booking Thành Công / Đặt Cọc', isTerminal: true },
      { fromState: 'in_progress', toState: 'in_progress', actionCode: 'CONTACTED', label: 'Đã Liên Hệ / Trao Đổi' },
      { fromState: 'in_progress', toState: 'in_progress', actionCode: 'CALL_BACK', label: 'Hẹn Gọi Lại Sau' },
      { fromState: 'in_progress', toState: 'in_progress', actionCode: 'VISIT', label: 'Hẹn Xem Dự Án / Nhà Mẫu' },
      { fromState: 'in_progress', toState: 'lost', actionCode: 'LOST', label: 'Khách Từ Chối / Đã Mua Chỗ Khác', isTerminal: true },
    ],
  },

  getEligibleAssignees: (_resource: ResourceRef): AssigneeUser[] => [
    { id: 'sale-001', name: 'Nguyễn Văn A', role: 'Senior Sales Specialist' },
    { id: 'sale-002', name: 'Trần Thị B', role: 'Real Estate Consultant' },
    { id: 'sale-003', name: 'Lê Hoàng C', role: 'Sales Executive' },
    { id: 'sale-004', name: 'Phạm Thanh D', role: 'Junior Agent' },
  ],

  getNextRotationAssignee: (resource: ResourceRef, currentAssigneeId?: string): AssigneeUser => {
    const sales = REAL_ESTATE_LEAD_PROVIDER.getEligibleAssignees!(resource);
    const eligible = sales.filter(s => s.id !== currentAssigneeId);
    return eligible.length > 0
      ? eligible[Math.floor(Math.random() * eligible.length)]
      : { id: 'sale-backup', name: 'Quản Lý Sàn Dự Phòng' };
  },

  formatNotification: (event) => {
    return {
      title: `[Lead Engine] ${event.eventType}`,
      body: `Chi tiết lead ID: ${event.resourceId} do ${event.actorName} thực hiện.`,
    };
  },
};

/**
 * Register Real Estate Lead Provider into Enterprise Resource Registry
 */
export function registerRealEstateLeadProvider() {
  resourceRegistry.register(REAL_ESTATE_LEAD_PROVIDER);
}
