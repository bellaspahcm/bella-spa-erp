export interface FamilyMember {
  readonly name: string;
  readonly relationship: string;
  readonly phone?: string;
}

export interface CoOwner {
  readonly name: string;
  readonly phone?: string;
  readonly relationToPrimary: string;
}

export interface InvestmentProfile {
  readonly budgetRange: string;
  readonly preferredTypes: string[];
  readonly preferredAreas: string[];
}

export interface Customer360Props {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly phone: string;
  readonly email?: string;
  readonly familyMembers: FamilyMember[];
  readonly coOwners: CoOwner[];
  investmentProfile?: InvestmentProfile;
  readonly tags: string[];
}

export class Customer360Aggregate {
  constructor(private readonly props: Customer360Props) {
    if (!props.id) throw new Error('Customer ID is required');
    if (!props.tenantId) throw new Error('Tenant ID is required');
    if (!props.name) throw new Error('Customer name is required');
    if (!props.phone) throw new Error('Customer phone is required');
  }

  public get id(): string {
    return this.props.id;
  }

  public get tenantId(): string {
    return this.props.tenantId;
  }

  public get name(): string {
    return this.props.name;
  }

  public get phone(): string {
    return this.props.phone;
  }

  public get email(): string | undefined {
    return this.props.email;
  }

  public get familyMembers(): FamilyMember[] {
    return [...this.props.familyMembers];
  }

  public get coOwners(): CoOwner[] {
    return [...this.props.coOwners];
  }

  public get investmentProfile(): InvestmentProfile | undefined {
    return this.props.investmentProfile ? { ...this.props.investmentProfile } : undefined;
  }

  public get tags(): string[] {
    return [...this.props.tags];
  }

  /**
   * Add a family member with validation
   */
  public addFamilyMember(member: FamilyMember): void {
    if (!member.name || !member.relationship) {
      throw new Error('Family member name and relationship are required');
    }
    this.props.familyMembers.push(member);
  }

  /**
   * Add a co-owner with validation
   */
  public addCoOwner(owner: CoOwner): void {
    if (!owner.name || !owner.relationToPrimary) {
      throw new Error('Co-owner name and relationship to primary are required');
    }
    this.props.coOwners.push(owner);
  }

  /**
   * Update investment preferences profile
   */
  public updateInvestmentProfile(profile: InvestmentProfile): void {
    this.props.investmentProfile = profile;
  }

  /**
   * Tag customer for segmented marketing campaigns
   */
  public addTag(tag: string): void {
    if (!tag) return;
    if (!this.props.tags.includes(tag)) {
      this.props.tags.push(tag);
    }
  }
}
