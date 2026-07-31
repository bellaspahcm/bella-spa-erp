import { ContractDomainModel } from '../../domain/contract';

export interface SignContractInput {
  contract: ContractDomainModel;
  signDate: string;
}

export class SignContractCommandHandler {
  static handle(input: SignContractInput): void {
    if (!input.signDate) {
      throw new Error('Sign date is required to execute contract');
    }
    input.contract.sign(input.signDate);
  }
}
