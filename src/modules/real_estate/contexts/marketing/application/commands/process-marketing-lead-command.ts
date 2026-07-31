import { MarketingLeadDomainModel } from '../../domain/marketing-lead';

export interface ProcessMarketingLeadInput {
  lead: MarketingLeadDomainModel;
}

export class ProcessMarketingLeadCommandHandler {
  static handle(input: ProcessMarketingLeadInput): void {
    if (input.lead.properties.processed) {
      throw new Error('Marketing lead is already processed');
    }
    input.lead.process();
  }
}
