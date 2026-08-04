'use client';

import React, { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Search, 
  Car, 
  Settings, 
  TrendingUp, 
  Plus, 
  Compass, 
  CheckCircle,
  HelpCircle,
  Clock,
  ArrowUpRight,
  Filter,
  DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { type OwnedVehicle, type AutoCustomerProfile } from '@/modules/bella-auto/services/AutoCustomerProvider';

// MOCK CUSTOMERS & AUTOMOTIVE PROFILES
const MOCK_CUSTOMERS = [
  { id: 'c1', name: 'Nguyễn Văn A', phone: '0901234567', email: 'vanya@gmail.com', address: 'Quận 1, TP.HCM', totalSpend: 5499000000 },
  { id: 'c2', name: 'Trần Thị B',   phone: '0987654321', email: 'thib@yahoo.com',   address: 'Cầu Giấy, Hà Nội', totalSpend: 2439000000 },
  { id: 'c3', name: 'Lê Hoàng C',   phone: '0911223344', email: 'hoangc@outlook.com', address: 'Hải Châu, Đà Nẵng', totalSpend: 0 },
];

const MOCK_PROFILES: Record<string, AutoCustomerProfile> = {
  c1: { customerId: 'c1', preferredBrands: ['BMW', 'Porsche'], preferredSegments: ['SUV', 'Sedan'], budgetRange: '3B - 6B', purchasingPurpose: 'Gia đình & Ngoại giao', totalVehiclesOwned: 1, totalValueSpent: 5599000000 },
  c2: { customerId: 'c2', preferredBrands: ['BMW', 'VinFast'], preferredSegments: ['Sedan'], budgetRange: '1.5B - 3B', purchasingPurpose: 'Di chuyển hàng ngày', totalVehiclesOwned: 1, totalValueSpent: 2439000000 },
  c3: { customerId: 'c3', preferredBrands: ['Mercedes-Benz'], preferredSegments: ['Crossover'], budgetRange: '2B - 4B', purchasingPurpose: 'Công việc', totalVehiclesOwned: 0, totalValueSpent: 0 },
};

const MOCK_OWNED_VEHICLES: Record<string, OwnedVehicle[]> = {
  c1: [
    { ownerRecordId: 'or1', vehicleId: 'v3', vin: 'WBA53AZ04M8F12345', colorExterior: 'São Paulo Yellow', modelYear: 2026, variantName: 'Competition Coupe', modelName: 'M4', brandName: 'BMW', ownershipType: 'primary', licensePlate: '30K-999.99', registrationDate: '2026-07-28', isActive: true, transferredAt: null }
  ],
  c2: [
    { ownerRecordId: 'or2', vehicleId: 'v1', vin: 'WBAHF3C01L7D34567', colorExterior: 'Alpine White', modelYear: 2026, variantName: '330i Luxury Line', modelName: '3 Series', brandName: 'BMW', ownershipType: 'primary', licensePlate: '51K-888.88', registrationDate: '2026-07-20', isActive: true, transferredAt: null }
  ],
  c3: [],
};

export default function Customer360Page() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('c1');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const [tick, setTick] = useState(0);
  // Track profiles in state to avoid mutating module-level const
  const [profiles, setProfiles] = useState<Record<string, AutoCustomerProfile>>(MOCK_PROFILES);

  // Form states for Automotive preferences
  const [prefForm, setPrefForm] = useState({
    brands: '',
    segments: '',
    budget: '',
    purpose: ''
  });

  const activeCustomer = MOCK_CUSTOMERS.find(c => c.id === selectedCustomerId) || MOCK_CUSTOMERS[0];
  const activeProfile = profiles[activeCustomer.id];
  const activeVehicles = MOCK_OWNED_VEHICLES[activeCustomer.id] || [];

  const handleUpdatePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await new Promise(r => setTimeout(r, 650));
      setProfiles(prev => ({
        ...prev,
        [activeCustomer.id]: {
          ...prev[activeCustomer.id],
          preferredBrands: prefForm.brands.split(',').map(s => s.trim()).filter(Boolean),
          preferredSegments: prefForm.segments.split(',').map(s => s.trim()).filter(Boolean),
          budgetRange: prefForm.budget,
          purchasingPurpose: prefForm.purpose
        }
      }));
      setTick(t => t + 1);
      toast.success('Đã cập nhật sở thích xe của khách hàng!');
    });
  };

  // Sync Form with activeProfile (from state, not module const)
  React.useEffect(() => {
    if (activeProfile) {
      setPrefForm({
        brands: activeProfile.preferredBrands.join(', '),
        segments: activeProfile.preferredSegments.join(', '),
        budget: activeProfile.budgetRange || '',
        purpose: activeProfile.purchasingPurpose || ''
      });
    }
  }, [selectedCustomerId, activeProfile]);

  const filteredCustomers = MOCK_CUSTOMERS.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.includes(searchQuery)
  );

  return (
    <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-950 p-6 md:p-10 space-y-8" data-auto-layout>
      {/* Header */}
      <div className="border-b border-slate-200/60 dark:border-slate-800 pb-6">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <User className="w-8 h-8 text-indigo-600" />
          Hồ Sơ Khách Hàng 360°
        </h1>
        <p className="text-sm text-muted-foreground font-semibold mt-1">
          Automotive View — Quản lý lịch sử sở hữu phương tiện, sở thích và hành vi của chủ xe
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Customers list */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors w-4 h-4" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc SĐT..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs font-semibold"
            />
          </div>

          <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
            {filteredCustomers.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCustomerId(c.id)}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between ${c.id === selectedCustomerId ? 'bg-indigo-50/50 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900/50' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-300'}`}
              >
                <div>
                  <div className="font-bold text-xs text-slate-800 dark:text-slate-200">{c.name}</div>
                  <div className="text-[10px] text-slate-400 font-semibold mt-0.5">{c.phone}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black rounded-lg px-2 py-1">
                    {(MOCK_PROFILES[c.id]?.totalVehiclesOwned || 0)} xe
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Automotive details & Customer 360 */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: Core profile with quick statistics */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-3 flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 font-bold text-lg">
                {activeCustomer.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-base font-black text-slate-950 dark:text-white">{activeCustomer.name}</h3>
                <p className="text-xs text-slate-400 font-semibold">{activeCustomer.phone} · {activeCustomer.email} · {activeCustomer.address}</p>
              </div>
            </div>

            <div className="bg-slate-50/50 dark:bg-slate-950/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Số xe đang sở hữu</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 flex items-baseline gap-1.5">
                {activeProfile?.totalVehiclesOwned || 0}
                <span className="text-xs text-slate-400 font-bold">chiếc</span>
              </p>
            </div>
            
            <div className="bg-slate-50/50 dark:bg-slate-950/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Ngân sách quan tâm</span>
              <p className="text-sm font-bold text-slate-850 dark:text-slate-100 mt-2 flex items-center gap-1">
                <DollarSign className="w-4 h-4 text-indigo-500" />
                {activeProfile?.budgetRange || 'Chưa thiết lập'}
              </p>
            </div>

            <div className="bg-slate-50/50 dark:bg-slate-950/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Giá trị chi tiêu (Xe)</span>
              <p className="text-sm font-extrabold text-slate-900 dark:text-white mt-2">
                {((activeProfile?.totalValueSpent || 0) / 1_000_000_000).toFixed(3)}B VND
              </p>
            </div>
          </div>

          {/* Card 2: Owned Vehicles list */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 space-y-4">
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Car className="w-4 h-4" /> Phương Tiện Sở Hữu
            </h4>
            
            <div className="space-y-3">
              {activeVehicles.length > 0 ? activeVehicles.map(v => (
                <div key={v.ownerRecordId} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50/30 dark:bg-slate-950/10 rounded-2xl border border-slate-150/60 dark:border-slate-800 gap-4">
                  <div>
                    <div className="font-extrabold text-xs text-slate-800 dark:text-slate-200">{v.brandName} {v.modelName}</div>
                    <div className="text-[10px] text-slate-400 font-semibold mt-0.5">{v.variantName} · {v.modelYear}</div>
                    <div className="font-mono text-[10px] text-indigo-500 font-bold mt-1 tracking-wider">VIN: {v.vin}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] font-black bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-lg px-2 py-1">Biển số: {v.licensePlate || 'Chưa ĐK'}</span>
                      <p className="text-[9px] text-slate-400 font-bold mt-1">Đăng ký: {v.registrationDate}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              )) : (
                <div className="py-8 text-center text-slate-400 italic text-xs font-semibold">Khách hàng hiện chưa sở hữu xe nào trong hệ thống.</div>
              )}
            </div>
          </div>

          {/* Card 3: Automotive Preferences Profile (Upsert Form) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 space-y-4">
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Compass className="w-4 h-4" /> Sở Thích & Hành Vi Automotive
            </h4>
            
            <form onSubmit={handleUpdatePreferences} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Thương Hiệu Quan Tâm</label>
                  <input
                    type="text"
                    value={prefForm.brands}
                    onChange={e => setPrefForm(f => ({ ...f, brands: e.target.value }))}
                    placeholder="BMW, Porsche, VinFast"
                    className="w-full px-4.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Phân Khúc Xe Quan Tâm</label>
                  <input
                    type="text"
                    value={prefForm.segments}
                    onChange={e => setPrefForm(f => ({ ...f, segments: e.target.value }))}
                    placeholder="SUV, Sedan, Crossover"
                    className="w-full px-4.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Mức Tài Chính Dự Kiến</label>
                  <input
                    type="text"
                    value={prefForm.budget}
                    onChange={e => setPrefForm(f => ({ ...f, budget: e.target.value }))}
                    placeholder="3B - 5B"
                    className="w-full px-4.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Mục Đích Mua Xe</label>
                  <input
                    type="text"
                    value={prefForm.purpose}
                    onChange={e => setPrefForm(f => ({ ...f, purpose: e.target.value }))}
                    placeholder="Đi làm, gặp khách hàng, gia đình"
                    className="w-full px-4.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs font-semibold"
                  />
                </div>
              </div>
              
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white dark:bg-white dark:text-slate-900 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5"
                >
                  {isPending && <span className="w-3 h-3 border-2 border-slate-400 border-t-white rounded-full animate-spin mr-1" />}
                  Lưu Thay Đổi
                </button>
              </div>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
}
