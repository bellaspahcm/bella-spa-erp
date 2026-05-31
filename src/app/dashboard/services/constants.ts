import type { ServiceFormState } from './types';

export const PAGE_SIZE = 2;

export function createBlankServiceForm(): ServiceFormState {
  return {
    name: '',
    price: '',
    duration: '',
    sessions: '',
    offer: '',
    details: '',
    ktvCommission: '',
    status: 'active',
  };
}
