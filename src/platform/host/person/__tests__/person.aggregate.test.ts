/**
 * Person Aggregate Unit Tests
 * 
 * Tests domain logic (no infrastructure dependencies).
 */

import { PersonAggregate } from '../person.aggregate';
import { CreatePersonRequest, UpdatePersonRequest } from '../types';

describe('PersonAggregate', () => {
  const validRequest: CreatePersonRequest = {
    tenantId: 'tenant-123',
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '1990-01-15',
    gender: 'male',
  };

  describe('create', () => {
    it('should create person with valid data', () => {
      const aggregate = PersonAggregate.create(validRequest);
      const person = aggregate.getPerson();

      expect(person.firstName).toBe('John');
      expect(person.lastName).toBe('Doe');
      expect(person.dateOfBirth).toBe('1990-01-15');
      expect(person.gender).toBe('male');
      expect(person.status).toBe('active');
      expect(person.personId).toBeDefined();
      expect(person.createdAt).toBeDefined();
      expect(person.updatedAt).toBeDefined();
    });

    it('should trim whitespace from names', () => {
      const aggregate = PersonAggregate.create({
        ...validRequest,
        firstName: '  John  ',
        lastName: '  Doe  ',
      });

      const person = aggregate.getPerson();
      expect(person.firstName).toBe('John');
      expect(person.lastName).toBe('Doe');
    });

    it('should set default preferred language to vi', () => {
      const aggregate = PersonAggregate.create(validRequest);
      const person = aggregate.getPerson();

      expect(person.preferredLanguage).toBe('vi');
    });

    it('should throw error if tenant ID missing', () => {
      expect(() => {
        PersonAggregate.create({
          ...validRequest,
          tenantId: '',
        });
      }).toThrow('Tenant ID is required');
    });

    it('should throw error if first name missing', () => {
      expect(() => {
        PersonAggregate.create({
          ...validRequest,
          firstName: '',
        });
      }).toThrow('First name is required');
    });

    it('should throw error if last name missing', () => {
      expect(() => {
        PersonAggregate.create({
          ...validRequest,
          lastName: '',
        });
      }).toThrow('Last name is required');
    });

    it('should throw error if date of birth missing', () => {
      expect(() => {
        PersonAggregate.create({
          ...validRequest,
          dateOfBirth: '',
        });
      }).toThrow('Date of birth is required');
    });

    it('should throw error if date of birth in future', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      expect(() => {
        PersonAggregate.create({
          ...validRequest,
          dateOfBirth: futureDate.toISOString().split('T')[0],
        });
      }).toThrow('Date of birth cannot be in the future');
    });

    it('should throw error if date of birth invalid format', () => {
      expect(() => {
        PersonAggregate.create({
          ...validRequest,
          dateOfBirth: '1990/01/15', // Wrong format
        });
      }).toThrow('Invalid date format');
    });

    it('should accept valid contacts', () => {
      const aggregate = PersonAggregate.create({
        ...validRequest,
        contacts: [
          {
            type: 'email',
            value: 'john.doe@example.com',
            isPrimary: true,
          },
          {
            type: 'mobile',
            value: '+84901234567',
            isPrimary: true,
          },
        ],
      });

      const person = aggregate.getPerson();
      expect(person.contacts).toHaveLength(2);
      expect(person.contacts[0].type).toBe('email');
      expect(person.contacts[1].type).toBe('mobile');
    });

    it('should throw error if email invalid', () => {
      expect(() => {
        PersonAggregate.create({
          ...validRequest,
          contacts: [
            {
              type: 'email',
              value: 'invalid-email',
              isPrimary: true,
            },
          ],
        });
      }).toThrow('Invalid email format');
    });

    it('should throw error if phone invalid', () => {
      expect(() => {
        PersonAggregate.create({
          ...validRequest,
          contacts: [
            {
              type: 'phone',
              value: '123', // Too short
              isPrimary: true,
            },
          ],
        });
      }).toThrow('Invalid phone format');
    });
  });

  describe('update', () => {
    it('should update person with valid data', () => {
      const aggregate = PersonAggregate.create(validRequest);
      
      const updateRequest: UpdatePersonRequest = {
        personId: aggregate.getPersonId(),
        tenantId: 'tenant-123',
        firstName: 'Jane',
        lastName: 'Smith',
      };

      const updatedAggregate = aggregate.update(updateRequest);
      const person = updatedAggregate.getPerson();

      expect(person.firstName).toBe('Jane');
      expect(person.lastName).toBe('Smith');
      expect(person.dateOfBirth).toBe('1990-01-15'); // Unchanged
    });

    it('should throw error if tenant mismatch', () => {
      const aggregate = PersonAggregate.create(validRequest);
      
      const updateRequest: UpdatePersonRequest = {
        personId: aggregate.getPersonId(),
        tenantId: 'different-tenant',
        firstName: 'Jane',
      };

      expect(() => {
        aggregate.update(updateRequest);
      }).toThrow('Person does not belong to this tenant');
    });

    it('should update updatedAt timestamp', async () => {
      const aggregate = PersonAggregate.create(validRequest);
      const originalUpdatedAt = aggregate.getPerson().updatedAt;

      // Small delay to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      const updateRequest: UpdatePersonRequest = {
        personId: aggregate.getPersonId(),
        tenantId: 'tenant-123',
        firstName: 'Jane',
      };

      const updatedAggregate = aggregate.update(updateRequest);
      const newUpdatedAt = updatedAggregate.getPerson().updatedAt;

      expect(newUpdatedAt).not.toBe(originalUpdatedAt);
    });
  });

  describe('deactivate', () => {
    it('should mark person as inactive', () => {
      const aggregate = PersonAggregate.create(validRequest);
      const deactivated = aggregate.deactivate();
      const person = deactivated.getPerson();

      expect(person.status).toBe('inactive');
    });
  });

  describe('markDeceased', () => {
    it('should mark person as deceased', () => {
      const aggregate = PersonAggregate.create(validRequest);
      const deceased = aggregate.markDeceased();
      const person = deceased.getPerson();

      expect(person.status).toBe('deceased');
    });
  });

  describe('addIdentifier', () => {
    it('should add identifier to person', () => {
      const aggregate = PersonAggregate.create(validRequest);
      const withIdentifier = aggregate.addIdentifier({
        type: 'national-id',
        value: '079090001234',
        isPrimary: true,
      });

      const person = withIdentifier.getPerson();
      expect(person.identifiers).toHaveLength(1);
      expect(person.identifiers[0].type).toBe('national-id');
      expect(person.identifiers[0].value).toBe('079090001234');
    });

    it('should throw error if identifier already exists', () => {
      const aggregate = PersonAggregate.create({
        ...validRequest,
        identifiers: [
          {
            type: 'national-id',
            value: '079090001234',
            isPrimary: true,
          },
        ],
      });

      expect(() => {
        aggregate.addIdentifier({
          type: 'national-id',
          value: '079090001234',
          isPrimary: true,
        });
      }).toThrow('Identifier national-id with value 079090001234 already exists');
    });
  });

  describe('addContact', () => {
    it('should add contact to person', () => {
      const aggregate = PersonAggregate.create(validRequest);
      const withContact = aggregate.addContact({
        type: 'email',
        value: 'john.doe@example.com',
        isPrimary: true,
      });

      const person = withContact.getPerson();
      expect(person.contacts).toHaveLength(1);
      expect(person.contacts[0].type).toBe('email');
      expect(person.contacts[0].value).toBe('john.doe@example.com');
    });

    it('should throw error if contact already exists', () => {
      const aggregate = PersonAggregate.create({
        ...validRequest,
        contacts: [
          {
            type: 'email',
            value: 'john.doe@example.com',
            isPrimary: true,
          },
        ],
      });

      expect(() => {
        aggregate.addContact({
          type: 'email',
          value: 'john.doe@example.com',
          isPrimary: true,
        });
      }).toThrow('Contact email with value john.doe@example.com already exists');
    });
  });

  describe('addAddress', () => {
    it('should add address to person', () => {
      const aggregate = PersonAggregate.create(validRequest);
      const withAddress = aggregate.addAddress({
        use: 'home',
        line1: '123 Main St',
        city: 'Hanoi',
        country: 'VN',
        isPrimary: true,
      });

      const person = withAddress.getPerson();
      expect(person.addresses).toHaveLength(1);
      expect(person.addresses[0].use).toBe('home');
      expect(person.addresses[0].line1).toBe('123 Main St');
    });
  });

  describe('getFullName', () => {
    it('should return full name with middle name', () => {
      const aggregate = PersonAggregate.create({
        ...validRequest,
        middleName: 'Michael',
      });

      expect(aggregate.getFullName()).toBe('John Michael Doe');
    });

    it('should return full name without middle name', () => {
      const aggregate = PersonAggregate.create(validRequest);

      expect(aggregate.getFullName()).toBe('John Doe');
    });
  });

  describe('isActive', () => {
    it('should return true for active person', () => {
      const aggregate = PersonAggregate.create(validRequest);

      expect(aggregate.isActive()).toBe(true);
    });

    it('should return false for inactive person', () => {
      const aggregate = PersonAggregate.create(validRequest);
      const inactive = aggregate.deactivate();

      expect(inactive.isActive()).toBe(false);
    });
  });

  describe('getPrimaryContact', () => {
    it('should return primary email', () => {
      const aggregate = PersonAggregate.create({
        ...validRequest,
        contacts: [
          {
            type: 'email',
            value: 'john.doe@example.com',
            isPrimary: true,
          },
          {
            type: 'email',
            value: 'john.work@example.com',
            isPrimary: false,
          },
        ],
      });

      const primaryEmail = aggregate.getPrimaryContact('email');
      expect(primaryEmail?.value).toBe('john.doe@example.com');
    });

    it('should return undefined if no primary contact', () => {
      const aggregate = PersonAggregate.create(validRequest);

      const primaryEmail = aggregate.getPrimaryContact('email');
      expect(primaryEmail).toBeUndefined();
    });
  });

  describe('getPrimaryAddress', () => {
    it('should return primary address', () => {
      const aggregate = PersonAggregate.create({
        ...validRequest,
        addresses: [
          {
            use: 'home',
            line1: '123 Main St',
            city: 'Hanoi',
            country: 'VN',
            isPrimary: true,
          },
          {
            use: 'work',
            line1: '456 Office Blvd',
            city: 'Hanoi',
            country: 'VN',
            isPrimary: false,
          },
        ],
      });

      const primaryAddress = aggregate.getPrimaryAddress();
      expect(primaryAddress?.line1).toBe('123 Main St');
    });

    it('should return undefined if no primary address', () => {
      const aggregate = PersonAggregate.create(validRequest);

      const primaryAddress = aggregate.getPrimaryAddress();
      expect(primaryAddress).toBeUndefined();
    });
  });
});

