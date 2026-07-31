export interface InvestorInteraction {
  id: string;
  type: 'call' | 'viewing' | 'email' | 'meeting';
  notes: string;
  date: string;
}

export interface InvestorProperties {
  id: string;
  tenantId: string;
  fullName: string;
  phone: string;
  email?: string;
  budgetRange: { min: number; max: number };
  interestedProjectIds: string[];
  interactions: InvestorInteraction[];
  status: 'lead' | 'contacted' | 'negotiating' | 'closed_won' | 'closed_lost';
}

export class InvestorDomainModel {
  constructor(private props: InvestorProperties) {}

  get properties(): InvestorProperties {
    return { ...this.props };
  }

  addInteraction(interaction: Omit<InvestorInteraction, 'id' | 'date'>): void {
    this.props.interactions.push({
      id: `int-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: interaction.type,
      notes: interaction.notes,
      date: new Date().toISOString(),
    });
  }

  updateBudget(min: number, max: number): void {
    if (min < 0 || max < min) {
      throw new Error('Invalid budget range values');
    }
    this.props.budgetRange = { min, max };
  }

  addInterestedProject(projectId: string): void {
    if (!this.props.interestedProjectIds.includes(projectId)) {
      this.props.interestedProjectIds.push(projectId);
    }
  }

  updateStatus(status: InvestorProperties['status']): void {
    this.props.status = status;
  }
}
