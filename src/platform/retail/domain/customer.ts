/**
 * Retail Customer Domain Entity
 * 
 * Canonical Authority: supabase/migrations/20260905000001_retail_os_canonical_schema.sql
 * Table: retail_customers
 */

import type { RetailCustomer as RetailCustomerRow } from '../../../types/retail-database.types';

export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
export type LoyaltyTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface CustomerProps {
  id: string;
  tenantId: string;
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  loyaltyPoints: number;
  loyaltyTier?: LoyaltyTier;
  status: CustomerStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomerCommand {
  tenantId: string;
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
}

export interface UpdateCustomerCommand {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}

export class Customer {
  private constructor(private props: CustomerProps) {}

  static create(command: CreateCustomerCommand): Customer {
    // Validation: Must have email OR phone
    if (!command.email && !command.phone) {
      throw new Error('Customer must have either email or phone');
    }

    const now = new Date();

    return new Customer({
      id: crypto.randomUUID(),
      tenantId: command.tenantId,
      email: command.email,
      phone: command.phone,
      firstName: command.firstName,
      lastName: command.lastName,
      loyaltyPoints: 0,
      loyaltyTier: 'BRONZE',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(row: RetailCustomerRow): Customer {
    return new Customer({
      id: row.id,
      tenantId: row.tenant_id,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      firstName: row.first_name,
      lastName: row.last_name,
      loyaltyPoints: row.loyalty_points ?? 0,
      loyaltyTier: row.loyalty_tier ?? undefined,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  update(command: UpdateCustomerCommand): void {
    // Calculate what the new values would be
    const newEmail = command.email === undefined ? this.props.email : command.email;
    const newPhone = command.phone === undefined ? this.props.phone : command.phone;

    // Validate: must have at least one contact method
    if (!newEmail && !newPhone) {
      throw new Error('Customer must have either email or phone');
    }

    // Apply updates
    if (command.email !== undefined) this.props.email = command.email;
    if (command.phone !== undefined) this.props.phone = command.phone;
    if (command.firstName !== undefined) this.props.firstName = command.firstName;
    if (command.lastName !== undefined) this.props.lastName = command.lastName;

    this.props.updatedAt = new Date();
  }

  addLoyaltyPoints(points: number): void {
    if (points <= 0) {
      throw new Error('Points to add must be positive');
    }

    this.props.loyaltyPoints += points;
    this.updateLoyaltyTier();
    this.props.updatedAt = new Date();
  }

  deductLoyaltyPoints(points: number): void {
    if (points <= 0) {
      throw new Error('Points to deduct must be positive');
    }

    if (points > this.props.loyaltyPoints) {
      throw new Error('Insufficient loyalty points');
    }

    this.props.loyaltyPoints -= points;
    this.updateLoyaltyTier();
    this.props.updatedAt = new Date();
  }

  private updateLoyaltyTier(): void {
    const points = this.props.loyaltyPoints;

    if (points >= 10000) {
      this.props.loyaltyTier = 'PLATINUM';
    } else if (points >= 5000) {
      this.props.loyaltyTier = 'GOLD';
    } else if (points >= 1000) {
      this.props.loyaltyTier = 'SILVER';
    } else {
      this.props.loyaltyTier = 'BRONZE';
    }
  }

  block(reason?: string): void {
    this.props.status = 'BLOCKED';
    this.props.updatedAt = new Date();
  }

  unblock(): void {
    if (this.props.status !== 'BLOCKED') {
      throw new Error('Customer is not blocked');
    }

    this.props.status = 'ACTIVE';
    this.props.updatedAt = new Date();
  }

  deactivate(): void {
    this.props.status = 'INACTIVE';
    this.props.updatedAt = new Date();
  }

  reactivate(): void {
    if (this.props.status === 'BLOCKED') {
      throw new Error('Cannot reactivate blocked customer - unblock first');
    }

    this.props.status = 'ACTIVE';
    this.props.updatedAt = new Date();
  }

  toPersistence(): RetailCustomerRow {
    return {
      id: this.props.id,
      tenant_id: this.props.tenantId,
      email: this.props.email ?? null,
      phone: this.props.phone ?? null,
      first_name: this.props.firstName,
      last_name: this.props.lastName,
      loyalty_points: this.props.loyaltyPoints,
      loyalty_tier: this.props.loyaltyTier ?? null,
      status: this.props.status,
      created_at: this.props.createdAt.toISOString(),
      updated_at: this.props.updatedAt.toISOString(),
    };
  }

  // Getters
  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get email(): string | undefined { return this.props.email; }
  get phone(): string | undefined { return this.props.phone; }
  get firstName(): string { return this.props.firstName; }
  get lastName(): string { return this.props.lastName; }
  get fullName(): string { return `${this.props.firstName} ${this.props.lastName}`; }
  get loyaltyPoints(): number { return this.props.loyaltyPoints; }
  get loyaltyTier(): LoyaltyTier | undefined { return this.props.loyaltyTier; }
  get status(): CustomerStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get isActive(): boolean { return this.props.status === 'ACTIVE'; }
  get isBlocked(): boolean { return this.props.status === 'BLOCKED'; }
}
