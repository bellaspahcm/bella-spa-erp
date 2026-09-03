/**
 * Person Application Service - Orchestration Layer
 * 
 * Orchestrates Person operations with infrastructure (database, events).
 * 
 * @module platform/host/person/person.service
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { PersonAggregate } from './person.aggregate';
import { PersonRepository } from './person.repository';
import {
  Person,
  CreatePersonRequest,
  UpdatePersonRequest,
  QueryPersonsRequest,
  PersonResponse,
  PersonDomainEvent,
} from './types';
import { Database } from '@/types/database.types';

/**
 * Person Application Service
 * 
 * Handles Person use cases and orchestrates infrastructure.
 */
export class PersonService {
  private repository: PersonRepository;

  constructor(private readonly supabase: SupabaseClient<Database>) {
    this.repository = new PersonRepository(supabase);
  }

  /**
   * Create a new person
   * 
   * @param request - Person creation request
   * @returns Created person
   */
  async createPerson(request: CreatePersonRequest): Promise<PersonResponse<Person>> {
    const startTime = Date.now();
    
    try {
      // 1. Create domain aggregate (business logic)
      const aggregate = PersonAggregate.create(request);
      const person = aggregate.getPerson();

      // 2. Persist to database
      const savedPerson = await this.repository.save(person);

      // 3. Publish domain event
      await this.publishEvent({
        eventType: 'person.created',
        eventVersion: '1.0.0',
        eventId: this.generateEventId(),
        timestamp: new Date().toISOString(),
        tenantId: savedPerson.tenantId,
        personId: savedPerson.personId,
        payload: {
          person: savedPerson,
        },
        metadata: {
          source: 'person-service',
        },
      });

      return {
        success: true,
        data: savedPerson,
        metadata: {
          requestId: this.generateRequestId(),
          executionTimeMs: Date.now() - startTime,
          version: '1.0.0',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CREATE_PERSON_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
        metadata: {
          requestId: this.generateRequestId(),
          executionTimeMs: Date.now() - startTime,
          version: '1.0.0',
        },
      };
    }
  }

  /**
   * Update existing person
   * 
   * @param request - Person update request
   * @returns Updated person
   */
  async updatePerson(request: UpdatePersonRequest): Promise<PersonResponse<Person>> {
    const startTime = Date.now();
    
    try {
      // 1. Load existing person
      const existingPerson = await this.repository.findById(request.personId, request.tenantId);
      
      if (!existingPerson) {
        return {
          success: false,
          error: {
            code: 'PERSON_NOT_FOUND',
            message: `Person with ID ${request.personId} not found`,
            timestamp: new Date().toISOString(),
          },
          metadata: {
            requestId: this.generateRequestId(),
            executionTimeMs: Date.now() - startTime,
            version: '1.0.0',
          },
        };
      }

      // 2. Create aggregate from existing person
      const existingAggregate = PersonAggregate.create({
        tenantId: existingPerson.tenantId,
        firstName: existingPerson.firstName,
        lastName: existingPerson.lastName,
        middleName: existingPerson.middleName,
        dateOfBirth: existingPerson.dateOfBirth,
        gender: existingPerson.gender,
        nationality: existingPerson.nationality,
        identifiers: existingPerson.identifiers,
        contacts: existingPerson.contacts,
        addresses: existingPerson.addresses,
        photoUrl: existingPerson.photoUrl,
        preferredLanguage: existingPerson.preferredLanguage,
        metadata: existingPerson.metadata,
      });

      // 3. Apply updates (business logic)
      const updatedAggregate = Object.assign(
        Object.create(Object.getPrototypeOf(existingAggregate)),
        existingAggregate
      ).update(request);
      
      const updatedPerson = updatedAggregate.getPerson();

      // 4. Persist to database
      const savedPerson = await this.repository.update(updatedPerson);

      // 5. Publish domain event
      await this.publishEvent({
        eventType: 'person.updated',
        eventVersion: '1.0.0',
        eventId: this.generateEventId(),
        timestamp: new Date().toISOString(),
        tenantId: savedPerson.tenantId,
        personId: savedPerson.personId,
        payload: {
          person: savedPerson,
          changes: request,
        },
        metadata: {
          source: 'person-service',
        },
      });

      return {
        success: true,
        data: savedPerson,
        metadata: {
          requestId: this.generateRequestId(),
          executionTimeMs: Date.now() - startTime,
          version: '1.0.0',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'UPDATE_PERSON_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
        metadata: {
          requestId: this.generateRequestId(),
          executionTimeMs: Date.now() - startTime,
          version: '1.0.0',
        },
      };
    }
  }

  /**
   * Get person by ID
   * 
   * @param personId - Person ID
   * @param tenantId - Tenant ID
   * @returns Person or null
   */
  async getPerson(personId: string, tenantId: string): Promise<PersonResponse<Person>> {
    const startTime = Date.now();
    
    try {
      const person = await this.repository.findById(personId, tenantId);

      if (!person) {
        return {
          success: false,
          error: {
            code: 'PERSON_NOT_FOUND',
            message: `Person with ID ${personId} not found`,
            timestamp: new Date().toISOString(),
          },
          metadata: {
            requestId: this.generateRequestId(),
            executionTimeMs: Date.now() - startTime,
            version: '1.0.0',
          },
        };
      }

      return {
        success: true,
        data: person,
        metadata: {
          requestId: this.generateRequestId(),
          executionTimeMs: Date.now() - startTime,
          version: '1.0.0',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GET_PERSON_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
        metadata: {
          requestId: this.generateRequestId(),
          executionTimeMs: Date.now() - startTime,
          version: '1.0.0',
        },
      };
    }
  }

  /**
   * Query persons with filters
   * 
   * @param request - Query request
   * @returns List of persons
   */
  async queryPersons(request: QueryPersonsRequest): Promise<PersonResponse<Person[]>> {
    const startTime = Date.now();
    
    try {
      const persons = await this.repository.query(request);

      return {
        success: true,
        data: persons,
        metadata: {
          requestId: this.generateRequestId(),
          executionTimeMs: Date.now() - startTime,
          version: '1.0.0',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'QUERY_PERSONS_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
        metadata: {
          requestId: this.generateRequestId(),
          executionTimeMs: Date.now() - startTime,
          version: '1.0.0',
        },
      };
    }
  }

  /**
   * Find person by identifier
   * 
   * @param tenantId - Tenant ID
   * @param identifierType - Identifier type (e.g., 'national-id', 'passport')
   * @param identifierValue - Identifier value
   * @returns Person or null
   */
  async findByIdentifier(
    tenantId: string,
    identifierType: string,
    identifierValue: string
  ): Promise<PersonResponse<Person>> {
    const startTime = Date.now();
    
    try {
      const person = await this.repository.findByIdentifier(tenantId, identifierType, identifierValue);

      if (!person) {
        return {
          success: false,
          error: {
            code: 'PERSON_NOT_FOUND',
            message: `Person with identifier ${identifierType}:${identifierValue} not found`,
            timestamp: new Date().toISOString(),
          },
          metadata: {
            requestId: this.generateRequestId(),
            executionTimeMs: Date.now() - startTime,
            version: '1.0.0',
          },
        };
      }

      return {
        success: true,
        data: person,
        metadata: {
          requestId: this.generateRequestId(),
          executionTimeMs: Date.now() - startTime,
          version: '1.0.0',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'FIND_BY_IDENTIFIER_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
        metadata: {
          requestId: this.generateRequestId(),
          executionTimeMs: Date.now() - startTime,
          version: '1.0.0',
        },
      };
    }
  }

  /**
   * Delete person (soft delete)
   * 
   * @param personId - Person ID
   * @param tenantId - Tenant ID
   * @returns Success response
   */
  async deletePerson(personId: string, tenantId: string): Promise<PersonResponse<void>> {
    const startTime = Date.now();
    
    try {
      await this.repository.delete(personId, tenantId);

      // Publish domain event
      await this.publishEvent({
        eventType: 'person.deleted',
        eventVersion: '1.0.0',
        eventId: this.generateEventId(),
        timestamp: new Date().toISOString(),
        tenantId,
        personId,
        payload: {},
        metadata: {
          source: 'person-service',
        },
      });

      return {
        success: true,
        metadata: {
          requestId: this.generateRequestId(),
          executionTimeMs: Date.now() - startTime,
          version: '1.0.0',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DELETE_PERSON_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
        metadata: {
          requestId: this.generateRequestId(),
          executionTimeMs: Date.now() - startTime,
          version: '1.0.0',
        },
      };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async publishEvent(event: PersonDomainEvent): Promise<void> {
    // TODO: Integrate with Event Bus when available
    // For now, log event (will be implemented in Platform Event Bus integration)
    console.log('[Person Service] Domain Event:', event.eventType, event.personId);
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

