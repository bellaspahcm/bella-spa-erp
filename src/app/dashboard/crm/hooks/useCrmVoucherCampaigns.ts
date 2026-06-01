'use client';

import type { FormEvent } from 'react';
import { useCallback, useState } from 'react';
import type { NewVoucherCampaign, VoucherCampaign } from '../types';

const DEFAULT_VOUCHER_TARGET = 'Bé tròn 1 tuổi';

const DEFAULT_NEW_VOUCHER: NewVoucherCampaign = {
  code: '',
  discount: 10,
  target: DEFAULT_VOUCHER_TARGET,
  status: 'active',
};

const INITIAL_VOUCHER_CAMPAIGNS: VoucherCampaign[] = [
  { code: 'BELLA_BABY_1ST', discount: 10, target: DEFAULT_VOUCHER_TARGET, status: 'active', usage: 12 },
  { code: 'MATERNITY_CARE_15', discount: 15, target: 'Mẹ bầu sắp sinh', status: 'active', usage: 8 },
  { code: 'WELCOME_NEWBORN', discount: 5, target: 'Trẻ sơ sinh', status: 'active', usage: 24 },
];

export function useCrmVoucherCampaigns() {
  const [vouchers, setVouchers] = useState<VoucherCampaign[]>(INITIAL_VOUCHER_CAMPAIGNS);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [newVoucher, setNewVoucher] = useState<NewVoucherCampaign>(DEFAULT_NEW_VOUCHER);

  const openVoucherModal = useCallback(() => {
    setIsVoucherModalOpen(true);
  }, []);

  const closeVoucherModal = useCallback(() => {
    setIsVoucherModalOpen(false);
  }, []);

  const handleCreateVoucher = useCallback((event: FormEvent) => {
    event.preventDefault();
    if (!newVoucher.code.trim()) return;

    setVouchers((currentVouchers) => [...currentVouchers, { ...newVoucher, usage: 0 }]);
    setIsVoucherModalOpen(false);
    setNewVoucher(DEFAULT_NEW_VOUCHER);
  }, [newVoucher]);

  return {
    vouchers,
    isVoucherModalOpen,
    newVoucher,
    setNewVoucher,
    openVoucherModal,
    closeVoucherModal,
    handleCreateVoucher,
  };
}
