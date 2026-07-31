import { InvestorDomainModel, InvestorInteraction } from '../../domain/investor';

export interface AddInteractionInput {
  investor: InvestorDomainModel;
  type: InvestorInteraction['type'];
  notes: string;
}

export class AddInteractionCommandHandler {
  static handle(input: AddInteractionInput): void {
    if (!input.notes.trim()) {
      throw new Error('Interaction notes cannot be empty');
    }
    input.investor.addInteraction({
      type: input.type,
      notes: input.notes,
    });
    // Move status to contacted if it was previously just a raw lead
    if (input.investor.properties.status === 'lead') {
      input.investor.updateStatus('contacted');
    }
  }
}
