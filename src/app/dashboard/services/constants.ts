import type { BookingResourceFormState, ServiceFormState } from './types';

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
    moduleKey: 'babycare',
    serviceKind: 'treatment_package',
    serviceCategory: '',
    defaultDurationMinutes: '90',
    requiresResource: false,
    defaultResourceType: 'bed',
    beforeAfterRequired: false,
    careNoteTemplate: '',
    lisCode: '',
    lisSampleType: '',
    lisTubeColor: '',
    risCode: '',
    risModality: 'XRAY',
    risBodySite: '',
  };
}

export function createBlankBookingResourceForm(): BookingResourceFormState {
  return {
    id: null,
    name: '',
    resourceType: 'bed',
    status: 'available',
    capacity: '1',
    locationNote: '',
  };
}
