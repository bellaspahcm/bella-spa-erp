import { ApartmentDomainModel } from '../domain/apartment';

describe('ApartmentDomainModel State Machine', () => {
  it('should allow valid transition from available to booked', () => {
    const apartment = new ApartmentDomainModel({
      id: 'apt-1',
      projectId: 'proj-1',
      unitCode: 'A-101',
      floor: 10,
      block: 'A',
      bedrooms: 2,
      bathrooms: 2,
      area: 75.5,
      price: 3500000000,
      status: 'available',
    });

    expect(apartment.canTransitionTo('booked')).toBe(true);
    apartment.transitionTo('booked', 'Nguyễn Văn A');
    expect(apartment.properties.status).toBe('booked');
    expect(apartment.properties.ownerName).toBe('Nguyễn Văn A');
  });

  it('should reject invalid transition from handed_over to available', () => {
    const apartment = new ApartmentDomainModel({
      id: 'apt-2',
      projectId: 'proj-1',
      unitCode: 'B-202',
      floor: 20,
      block: 'B',
      bedrooms: 3,
      bathrooms: 2,
      area: 90.0,
      price: 5000000000,
      status: 'handed_over',
      ownerName: 'Trần Thị B',
    });

    expect(apartment.canTransitionTo('available')).toBe(false);
    expect(() => apartment.transitionTo('available')).toThrow('Cannot transition apartment B-202 from handed_over to available');
  });
});
