/**
 * Person Aggregate - Domain Logic
 * 
 * Pure business logic for Person entity.
 * No infrastructure calls (database, event bus, etc.).
 * 
 * @module platform/host/person/person.aggregate
 */

import {
  Person,
  CreatePersonRequest,
  UpdatePersonRequest,
  PersonIdentifier,
  PersonContact,
  PersonAddress,
  ValidationResult,
  ValidationError,
} from './types';

/**
 * Person Aggregate
 * 
 * Encapsulates all business rules for Person entity.
 * Immutable - returns new instances instead of mutating.
 */
export class PersonAggregate {
  private constructor(private readonly person: Person) {}

  /**
   * Create a new Person aggregate
   * 
   * @param request - Person creation request
   * @returns PersonAggregate instance
   * @throws Error if validation fails
   */
  static create(request: CreatePersonRequest): PersonAggregate {
    // Validate input
    const validation = this.validateCreate(request);
    if (!validation.valid) {
      throw new Error(`Person validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Generate ID
    const personId = this.generatePersonId();
    const now = new Date().toISOString();

    // Create person
    const person: Person = {
      personId,
      tenantId: request.tenantId,
      firstName: request.firstName.trim(),
      lastName: request.lastName.trim(),
      middleName: request.middleName?.trim(),
      dateOfBirth: request.dateOfBirth,
      gender: request.gender,
      nationality: request.nationality,
      identifiers: request.identifiers || [],
      contacts: request.contacts || [],
      addresses: request.addresses || [],
      photoUrl: request.photoUrl,
      preferredLanguage: request.preferredLanguage || 'vi',
      status: 'active',
      metadata: request.metadata || {},
      createdAt: now,
      updatedAt: now,
    };

    return new PersonAggregate(person);
  }

  /**
   * Update person information
   * 
   * @param request - Person update request
   * @returns New PersonAggregate instance with updates
   * @throws Error if validation fails
   */
  update(request: UpdatePersonRequest): PersonAggregate {
    // Validate input
    const validation = PersonAggregate.validateUpdate(request);
    if (!validation.valid) {
      throw new Error(`Person update validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Validate person belongs to tenant
    if (request.tenantId !== this.person.tenantId) {
      throw new Error('Person does not belong to this tenant');
    }

    // Create updated person
    const updatedPerson: Person = {
      ...this.person,
      firstName: request.firstName?.trim() ?? this.person.firstName,
      lastName: request.lastName?.trim() ?? this.person.lastName,
      middleName: request.middleName?.trim() ?? this.person.middleName,
      dateOfBirth: request.dateOfBirth ?? this.person.dateOfBirth,
      gender: request.gender ?? this.person.gender,
      nationality: request.nationality ?? this.person.nationality,
      identifiers: request.identifiers ?? this.person.identifiers,
      contacts: request.contacts ?? this.person.contacts,
      addresses: request.addresses ?? this.person.addresses,
      photoUrl: request.photoUrl ?? this.person.photoUrl,
      preferredLanguage: request.preferredLanguage ?? this.person.preferredLanguage,
      status: request.status ?? this.person.status,
      metadata: request.metadata ?? this.person.metadata,
      updatedAt: new Date().toISOString(),
    };

    return new PersonAggregate(updatedPerson);
  }

  /**
   * Mark person as inactive
   */
  deactivate(): PersonAggregate {
    const updatedPerson: Person = {
      ...this.person,
      status: 'inactive',
      updatedAt: new Date().toISOString(),
    };

    return new PersonAggregate(updatedPerson);
  }

  /**
   * Mark person as deceased
   */
  markDeceased(): PersonAggregate {
    const updatedPerson: Person = {
      ...this.person,
      status: 'deceased',
      updatedAt: new Date().toISOString(),
    };

    return new PersonAggregate(updatedPerson);
  }

  /**
   * Add identifier to person
   */
  addIdentifier(identifier: PersonIdentifier): PersonAggregate {
    // Check if identifier already exists
    const exists = this.person.identifiers.some(
      i => i.type === identifier.type && i.value === identifier.value
    );

    if (exists) {
      throw new Error(`Identifier ${identifier.type} with value ${identifier.value} already exists`);
    }

    const updatedPerson: Person = {
      ...this.person,
      identifiers: [...this.person.identifiers, identifier],
      updatedAt: new Date().toISOString(),
    };

    return new PersonAggregate(updatedPerson);
  }

  /**
   * Add contact to person
   */
  addContact(contact: PersonContact): PersonAggregate {
    // Check if contact already exists
    const exists = this.person.contacts.some(
      c => c.type === contact.type && c.value === contact.value
    );

    if (exists) {
      throw new Error(`Contact ${contact.type} with value ${contact.value} already exists`);
    }

    const updatedPerson: Person = {
      ...this.person,
      contacts: [...this.person.contacts, contact],
      updatedAt: new Date().toISOString(),
    };

    return new PersonAggregate(updatedPerson);
  }

  /**
   * Add address to person
   */
  addAddress(address: PersonAddress): PersonAggregate {
    const updatedPerson: Person = {
      ...this.person,
      addresses: [...this.person.addresses, address],
      updatedAt: new Date().toISOString(),
    };

    return new PersonAggregate(updatedPerson);
  }

  /**
   * Get person data
   */
  getPerson(): Person {
    return { ...this.person };
  }

  /**
   * Get person ID
   */
  getPersonId(): string {
    return this.person.personId;
  }

  /**
   * Get full name
   */
  getFullName(): string {
    const parts = [
      this.person.firstName,
      this.person.middleName,
      this.person.lastName,
    ].filter(Boolean);

    return parts.join(' ');
  }

  /**
   * Check if person is active
   */
  isActive(): boolean {
    return this.person.status === 'active';
  }

  /**
   * Get primary contact by type
   */
  getPrimaryContact(type: 'phone' | 'email' | 'mobile'): PersonContact | undefined {
    return this.person.contacts.find(c => c.type === type && c.isPrimary);
  }

  /**
   * Get primary address
   */
  getPrimaryAddress(): PersonAddress | undefined {
    return this.person.addresses.find(a => a.isPrimary);
  }

  // ============================================================================
  // Private Validation Methods
  // ============================================================================

  private static validateCreate(request: CreatePersonRequest): ValidationResult {
    const errors: ValidationError[] = [];

    // Required fields
    if (!request.tenantId) {
      errors.push({ field: 'tenantId', message: 'Tenant ID is required', code: 'REQUIRED' });
    }

    if (!request.firstName || request.firstName.trim().length === 0) {
      errors.push({ field: 'firstName', message: 'First name is required', code: 'REQUIRED' });
    }

    if (!request.lastName || request.lastName.trim().length === 0) {
      errors.push({ field: 'lastName', message: 'Last name is required', code: 'REQUIRED' });
    }

    if (!request.dateOfBirth) {
      errors.push({ field: 'dateOfBirth', message: 'Date of birth is required', code: 'REQUIRED' });
    } else if (!this.isValidDate(request.dateOfBirth)) {
      errors.push({ field: 'dateOfBirth', message: 'Invalid date format (expected YYYY-MM-DD)', code: 'INVALID_FORMAT' });
    } else if (new Date(request.dateOfBirth) > new Date()) {
      errors.push({ field: 'dateOfBirth', message: 'Date of birth cannot be in the future', code: 'INVALID_VALUE' });
    }

    if (!request.gender) {
      errors.push({ field: 'gender', message: 'Gender is required', code: 'REQUIRED' });
    }

    // Validate contacts
    if (request.contacts) {
      request.contacts.forEach((contact, index) => {
        if (contact.type === 'email' && !this.isValidEmail(contact.value)) {
          errors.push({ field: `contacts[${index}].value`, message: 'Invalid email format', code: 'INVALID_FORMAT' });
        }
        if (contact.type === 'phone' && !this.isValidPhone(contact.value)) {
          errors.push({ field: `contacts[${index}].value`, message: 'Invalid phone format', code: 'INVALID_FORMAT' });
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private static validateUpdate(request: UpdatePersonRequest): ValidationResult {
    const errors: ValidationError[] = [];

    // Required fields
    if (!request.personId) {
      errors.push({ field: 'personId', message: 'Person ID is required', code: 'REQUIRED' });
    }

    if (!request.tenantId) {
      errors.push({ field: 'tenantId', message: 'Tenant ID is required', code: 'REQUIRED' });
    }

    // Optional field validation
    if (request.dateOfBirth) {
      if (!this.isValidDate(request.dateOfBirth)) {
        errors.push({ field: 'dateOfBirth', message: 'Invalid date format (expected YYYY-MM-DD)', code: 'INVALID_FORMAT' });
      } else if (new Date(request.dateOfBirth) > new Date()) {
        errors.push({ field: 'dateOfBirth', message: 'Date of birth cannot be in the future', code: 'INVALID_VALUE' });
      }
    }

    // Validate contacts
    if (request.contacts) {
      request.contacts.forEach((contact, index) => {
        if (contact.type === 'email' && !this.isValidEmail(contact.value)) {
          errors.push({ field: `contacts[${index}].value`, message: 'Invalid email format', code: 'INVALID_FORMAT' });
        }
        if (contact.type === 'phone' && !this.isValidPhone(contact.value)) {
          errors.push({ field: `contacts[${index}].value`, message: 'Invalid phone format', code: 'INVALID_FORMAT' });
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private static generatePersonId(): string {
    // Generate UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private static isValidDate(dateString: string): boolean {
    // Check format YYYY-MM-DD
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;

    // Check if valid date
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  private static isValidEmail(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  private static isValidPhone(phone: string): boolean {
    // Basic phone validation (digits, spaces, dashes, parentheses, plus)
    const regex = /^[\d\s\-()]+$/;
    return regex.test(phone) && phone.replace(/\D/g, '').length >= 7;
  }
}

