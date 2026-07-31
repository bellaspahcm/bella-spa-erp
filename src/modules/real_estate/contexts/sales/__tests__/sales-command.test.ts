import { CreateReservationCommandHandler } from '../application/commands/create-reservation-command';

describe('CreateReservationCommandHandler (Sales Bounded Context)', () => {
  it('should successfully create a reservation when apartment is available', () => {
    const reservation = CreateReservationCommandHandler.handle({
      apartment: {
        apartmentId: 'apt-101',
        unitCode: 'A-101',
        status: 'available',
        price: 3500000000,
      },
      customerName: 'Lê Văn C',
      customerPhone: '0901234567',
      depositAmount: 50000000,
    });

    expect(reservation.properties.apartmentId).toBe('apt-101');
    expect(reservation.properties.status).toBe('pending_deposit');
    expect(reservation.properties.customerName).toBe('Lê Văn C');
  });

  it('should throw an error when attempting to reserve an already deposited apartment', () => {
    expect(() => {
      CreateReservationCommandHandler.handle({
        apartment: {
          apartmentId: 'apt-102',
          unitCode: 'A-102',
          status: 'deposited',
          price: 4000000000,
        },
        customerName: 'Phạm Văn D',
        customerPhone: '0909876543',
        depositAmount: 50000000,
      });
    }).toThrow('Apartment A-102 is not available for reservation');
  });
});
