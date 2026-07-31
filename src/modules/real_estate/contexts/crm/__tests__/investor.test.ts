import { InvestorDomainModel } from '../domain/investor';
import { AddInteractionCommandHandler } from '../application/commands/add-interaction-command';

describe('Investor CRM Bounded Context', () => {
  it('should successfully update budget and add interested projects', () => {
    const investor = new InvestorDomainModel({
      id: 'inv-1',
      tenantId: 'tenant-123',
      fullName: 'Phan Văn E',
      phone: '0987654321',
      budgetRange: { min: 2000000000, max: 3000000000 },
      interestedProjectIds: [],
      interactions: [],
      status: 'lead',
    });

    investor.updateBudget(3000000000, 4500000000);
    expect(investor.properties.budgetRange.min).toBe(3000000000);
    expect(investor.properties.budgetRange.max).toBe(4500000000);

    investor.addInterestedProject('proj-alpha');
    expect(investor.properties.interestedProjectIds).toContain('proj-alpha');
  });

  it('should add interaction and transition status from lead to contacted', () => {
    const investor = new InvestorDomainModel({
      id: 'inv-2',
      tenantId: 'tenant-123',
      fullName: 'Trần Thị F',
      phone: '0912345678',
      budgetRange: { min: 1000000000, max: 2000000000 },
      interestedProjectIds: ['proj-alpha'],
      interactions: [],
      status: 'lead',
    });

    AddInteractionCommandHandler.handle({
      investor,
      type: 'call',
      notes: 'Gọi điện thoại giới thiệu dự án Alpha, khách quan tâm',
    });

    expect(investor.properties.interactions.length).toBe(1);
    expect(investor.properties.interactions[0].notes).toBe('Gọi điện thoại giới thiệu dự án Alpha, khách quan tâm');
    expect(investor.properties.status).toBe('contacted');
  });

  it('should throw an error if interaction notes are empty', () => {
    const investor = new InvestorDomainModel({
      id: 'inv-3',
      tenantId: 'tenant-123',
      fullName: 'Lê Văn G',
      phone: '0933333333',
      budgetRange: { min: 2000000000, max: 3000000000 },
      interestedProjectIds: [],
      interactions: [],
      status: 'lead',
    });

    expect(() => {
      AddInteractionCommandHandler.handle({
        investor,
        type: 'meeting',
        notes: '   ',
      });
    }).toThrow('Interaction notes cannot be empty');
  });
});
