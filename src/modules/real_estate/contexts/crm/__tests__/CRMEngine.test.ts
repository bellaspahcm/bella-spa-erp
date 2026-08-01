import { Customer360Aggregate } from '../domain/Customer360Aggregate';
import { LeadAggregate } from '../domain/LeadAggregate';
import { TransitionContext } from '@/platform/state-machine/state-machine';
import { SiteVisitTracker } from '../domain/SiteVisitTracker';
import { CommissionCalculator, AgentProfile, SaleContext } from '../domain/CommissionCalculator';

describe('CRM Bounded Context', () => {
  const tenantId = 'tenant-abc';

  describe('Customer360Aggregate', () => {
    it('should create profile and append family and co-owner relationships', () => {
      const customer = new Customer360Aggregate({
        id: 'cust-1',
        tenantId,
        name: 'Nguyen Van A',
        phone: '0901234567',
        familyMembers: [],
        coOwners: [],
        tags: [],
      });

      expect(customer.name).toBe('Nguyen Van A');

      customer.addFamilyMember({ name: 'Tran Thi B', relationship: 'Spouse', phone: '0907654321' });
      expect(customer.familyMembers.length).toBe(1);
      expect(customer.familyMembers[0].name).toBe('Tran Thi B');

      customer.addCoOwner({ name: 'Le Van C', relationToPrimary: 'Business Partner' });
      expect(customer.coOwners.length).toBe(1);
      expect(customer.coOwners[0].name).toBe('Le Van C');

      customer.updateInvestmentProfile({
        budgetRange: '3B-5B',
        preferredTypes: ['apartment'],
        preferredAreas: ['District 2', 'District 9'],
      });
      expect(customer.investmentProfile?.budgetRange).toBe('3B-5B');

      customer.addTag('VIP');
      customer.addTag('VIP'); // duplicate check
      expect(customer.tags).toEqual(['VIP']);
    });
  });

  describe('LeadAggregate', () => {
    const mockContext: TransitionContext = {
      tenantId,
      correlationId: 'corr-500',
      actor: { userId: 'agent-1' },
    };

    it('should transition through lead workflow states', async () => {
      const lead = new LeadAggregate({
        id: 'lead-1',
        tenantId,
        name: 'Prospect John',
        phone: '0999999999',
        state: 'NEW',
      });

      expect(lead.state).toBe('NEW');

      await lead.transition('ASSIGN', { ...mockContext, payload: { assignedTo: 'agent-100' } });
      expect(lead.state).toBe('ASSIGNED');
      expect(lead.assignedTo).toBe('agent-100');

      await lead.transition('CONTACT', mockContext);
      expect(lead.state).toBe('CONTACTED');

      await lead.transition('QUALIFY', mockContext);
      expect(lead.state).toBe('QUALIFIED');

      await lead.transition('SCHEDULE_VISIT', mockContext);
      expect(lead.state).toBe('VISIT_SCHEDULED');

      await lead.transition('NEGOTIATE', mockContext);
      expect(lead.state).toBe('NEGOTIATING');

      await lead.transition('CONVERT', mockContext);
      expect(lead.state).toBe('CONVERTED');
    });

    it('should capture lost states and reasons', async () => {
      const lead = new LeadAggregate({
        id: 'lead-2',
        tenantId,
        name: 'Prospect John',
        phone: '0999999999',
        state: 'CONTACTED',
      });

      await lead.transition('LOSE', { ...mockContext, payload: { lostReason: 'Price too high' } });
      expect(lead.state).toBe('LOST');
      expect(lead.lostReason).toBe('Price too high');
    });
  });

  describe('SiteVisitTracker', () => {
    const mockContext: TransitionContext = {
      tenantId,
      correlationId: 'corr-501',
      actor: { userId: 'agent-1' },
    };

    it('should schedule and complete a showroom visit', async () => {
      const visit = new SiteVisitTracker({
        id: 'visit-1',
        tenantId,
        leadId: 'lead-1',
        visitDate: new Date(),
        status: 'SCHEDULED',
      });

      expect(visit.status).toBe('SCHEDULED');

      await visit.transition('COMPLETE', { ...mockContext, payload: { feedback: 'Interested in 3-bedroom unit' } });
      expect(visit.status).toBe('COMPLETED');
      expect(visit.feedback).toBe('Interested in 3-bedroom unit');
    });
  });

  describe('CommissionCalculator', () => {
    const calculator = new CommissionCalculator();

    it('should calculate director commission with speed and seniority bonuses', () => {
      const agent: AgentProfile = {
        agentId: 'agent-director-1',
        role: 'director',
        seniorityMonths: 24, // 2 years -> 2,000,000 seniority bonus
      };

      const sale: SaleContext = {
        contractPrice: 5000000000, // 5B
        leadCreatedDate: new Date(2026, 7, 1),
        contractSignedDate: new Date(2026, 7, 5), // 4 days -> 10,000,000 speed bonus
      };

      // Base commission: 5B * 2% = 100,000,000
      // Seniority bonus: 2,000,000
      // Speed bonus: 10,000,000
      // Expected total: 112,000,000
      const res = calculator.calculateCommission(agent, sale);
      expect(res.baseCommission).toBe(100000000);
      expect(res.seniorityBonus).toBe(2000000);
      expect(res.speedBonus).toBe(10000000);
      expect(res.totalCommission).toBe(112000000);
    });
  });
});
