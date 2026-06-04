import type { Dispatch, SetStateAction } from 'react';

export type EditCustomerData = {
  name_mother: string;
  phone: string;
  name_baby: string;
  dob_expected: string;
  dob_baby: string;
  address: string;
  notes: string;
  gender_baby: string;
  latitude: number | null;
  longitude: number | null;
};

export type PaymentData = {
  amount: number;
  method: string;
  notes: string;
  receipt_url: string;
  status: string;
};

export type EditBookingData = {
  package_name: string;
  full_price: number;
  deposit_amount: number;
  discount_percent: number;
  total_sessions: number;
  completed_sessions: number;
  preferred_time: string;
  start_date: string;
  status: string;
};

export type ModalStateSetter<T> = Dispatch<SetStateAction<T>>;
