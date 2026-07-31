import { ContractDomainModel } from '../domain/contract';
import { SignContractCommandHandler } from '../application/commands/sign-contract-command';

describe('Contract Bounded Context', () => {
  it('should sign draft contract successfully', () => {
    const contract = new ContractDomainModel({
      id: 'ctr-1',
      tenantId: 'tenant-123',
      projectId: 'proj-1',
      apartmentId: 'apt-101',
      customerName: 'Nguyễn Văn H',
      totalValue: 3500000000,
      status: 'draft',
    });

    SignContractCommandHandler.handle({
      contract,
      signDate: '2026-07-31',
    });

    expect(contract.properties.status).toBe('signed');
    expect(contract.properties.signedDate).toBe('2026-07-31');
  });

  it('should fail to cancel signed contract', () => {
    const contract = new ContractDomainModel({
      id: 'ctr-2',
      tenantId: 'tenant-123',
      projectId: 'proj-1',
      apartmentId: 'apt-102',
      customerName: 'Trần Thị K',
      totalValue: 4000000000,
      signedDate: '2026-07-30',
      status: 'signed',
    });

    expect(() => {
      contract.cancel();
    }).toThrow('Cannot cancel a signed contract ctr-2');
  });
});
