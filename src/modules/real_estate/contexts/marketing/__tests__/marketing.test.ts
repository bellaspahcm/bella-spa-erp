import { MarketingLeadDomainModel } from '../domain/marketing-lead';
import { ProcessMarketingLeadCommandHandler } from '../application/commands/process-marketing-lead-command';

describe('Marketing Bounded Context', () => {
  it('should process marketing lead successfully', () => {
    const lead = new MarketingLeadDomainModel({
      id: 'lead-1',
      tenantId: 'tenant-123',
      source: 'facebook',
      customerName: 'Trần Văn L',
      customerPhone: '0977666555',
      rawMessage: 'Cần tư vấn căn 2 phòng ngủ dự án Gold',
      createdAt: '2026-07-31',
      processed: false,
    });

    ProcessMarketingLeadCommandHandler.handle({ lead });

    expect(lead.properties.processed).toBe(true);
  });

  it('should throw an error if lead is already processed', () => {
    const lead = new MarketingLeadDomainModel({
      id: 'lead-2',
      tenantId: 'tenant-123',
      source: 'website',
      customerName: 'Hoàng Thị M',
      customerPhone: '0988777666',
      rawMessage: 'Cần xem nhà mẫu',
      createdAt: '2026-07-31',
      processed: true,
    });

    expect(() => {
      ProcessMarketingLeadCommandHandler.handle({ lead });
    }).toThrow('Marketing lead is already processed');
  });
});
