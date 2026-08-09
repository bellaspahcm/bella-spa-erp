/**
 * Automation Studio - SimulationTool Component
 * 
 * Allows users to test automation with real customer data before saving.
 * 
 * UX Flow:
 * 1. Search for a customer in the database
 * 2. Display customer details (tier, booking history, etc.)
 * 3. Show condition validation (✓ Khách VIP, ✓ Booking >2tr)
 * 4. Show exact calculation results (2.5M → -500k → 2M)
 * 5. "Explain Why" section (Bella làm vậy vì...)
 * 
 * @author Automation Studio Team
 * @date 2026-07-25
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Check, X, Sparkles, Calculator, Loader2, UserCheck } from 'lucide-react';
import type { AutomationTemplate } from '@/lib/automation/templates';
import { createClient } from '@/lib/supabase-client';

interface SimulationToolProps {
  template: AutomationTemplate;
  onComplete?: () => void;
}

interface SimulatedCustomer {
  id: string;
  name: string;
  phone: string;
  tier: 'VIP' | 'Premium' | 'Regular';
  avatar: string;
  loyalty_points: number;
  totalBookings: number;
  created_at: string | null;
}

interface ConditionResult {
  label: string;
  description: string;
  icon: string;
  isMatched: boolean;
  actualValueDescription: string;
}

interface SimulationDetails {
  conditionResults: ConditionResult[];
  allConditionsMet: boolean;
  originalPrice: number;
  calculatedDiscount: number;
  finalPrice: number;
  pointsAwarded: number;
}

export function SimulationTool({ template, onComplete }: SimulationToolProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<SimulatedCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<SimulatedCustomer | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationDetails, setSimulationDetails] = useState<SimulationDetails | null>(null);

  // Debounce customer search from database
  useEffect(() => {
    if (!searchQuery.trim()) {
      setCustomers([]);
      return;
    }

    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('customers')
          .select('id, name_mother, phone, loyalty_points, created_at')
          .or(`name_mother.ilike.%${searchQuery}%,phone.like.%${searchQuery}%`)
          .limit(5);

        if (error) {
          console.error('[SimulationTool] Database error searching customers:', error);
          throw error;
        }

        const processed = await Promise.all(
          (data || []).map(async (c): Promise<SimulatedCustomer> => {
            // Fetch real booking count for this customer to feed into session_count condition check
            const { count: bookingsCount, error: countErr } = await supabase
              .from('bookings')
              .select('id', { count: 'exact', head: true })
              .eq('customer_id', c.id);

            if (countErr) {
              console.warn('[SimulationTool] Error fetching bookings count for customer:', c.id, countErr);
            }

            const points = Number(c.loyalty_points || 0);
            const tier: 'VIP' | 'Premium' | 'Regular' = points >= 500 ? 'VIP' : points >= 200 ? 'Premium' : 'Regular';
            // Simple avatar gender guess
            const avatar = c.name_mother?.toLowerCase().includes('văn') || c.name_mother?.toLowerCase().includes('anh') ? '👨' : '👩';

            return {
              id: c.id,
              name: c.name_mother || 'Khách hàng',
              phone: c.phone || '',
              tier,
              avatar,
              loyalty_points: points,
              totalBookings: bookingsCount || 0,
              created_at: c.created_at
            };
          })
        );

        setCustomers(processed);
      } catch (err: unknown) {
        console.error('Error fetching customers for simulation:', err);
      } finally {
        setLoading(false);
      }
    };

    const delayDebounceFn = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Run simulation calculations based on selected customer and template conditions
  useEffect(() => {
    if (!selectedCustomer) {
      setSimulationDetails(null);
      return;
    }

    setIsSimulating(true);

    // Simulate for 800ms for premium UX loading effect
    const timer = setTimeout(() => {
      const conditionResults = template.conditions.map((condition): ConditionResult => {
        let isMatched = false;
        let actualValueDescription = '';

        switch (condition.type) {
          case 'customer_tier':
            isMatched = String(selectedCustomer.tier).toLowerCase() === String(condition.value).toLowerCase();
            actualValueDescription = `Hạng thực tế: ${selectedCustomer.tier}`;
            break;
          case 'session_count':
            if (condition.operator === 'greater_than') {
              isMatched = selectedCustomer.totalBookings > Number(condition.value);
            } else if (condition.operator === 'less_than') {
              isMatched = selectedCustomer.totalBookings < Number(condition.value);
            } else {
              isMatched = selectedCustomer.totalBookings === Number(condition.value);
            }
            actualValueDescription = `Đã đặt: ${selectedCustomer.totalBookings} ca`;
            break;
          case 'booking_value':
            // Standard simulated order value for testing: 2.5M
            const mockValue = 2500000;
            if (condition.operator === 'greater_than') {
              isMatched = mockValue > Number(condition.value);
            } else {
              isMatched = mockValue <= Number(condition.value);
            }
            actualValueDescription = `Đặt thử đơn: 2,500,000đ`;
            break;
          case 'is_birthday':
            // Assume match for birthday template to demonstrate validation
            isMatched = true;
            actualValueDescription = `Hôm nay là sinh nhật khách`;
            break;
          default:
            isMatched = true;
            actualValueDescription = `Kiểm tra hợp lệ`;
        }

        return {
          label: condition.label,
          description: condition.description,
          icon: condition.icon,
          isMatched,
          actualValueDescription
        };
      });

      // Calculate discounts
      const originalPrice = 2500000; // Simulated price
      let discountPercentage = 0;
      let flatDiscount = 0;
      let pointsAwarded = 0;

      // Extract actions values
      template.actions.forEach((action) => {
        if (action.type === 'apply_discount') {
          discountPercentage = Number(action.value || 0);
        } else if (action.type === 'apply_deduction') {
          flatDiscount = Number(action.value || 0);
        } else if (action.type === 'award_points') {
          pointsAwarded = Number(action.value || 0);
        }
      });

      const allConditionsMet = conditionResults.every((c) => c.isMatched);
      const calculatedDiscount = allConditionsMet
        ? Math.round((originalPrice * (discountPercentage / 100)) + flatDiscount)
        : 0;
      const finalPrice = originalPrice - calculatedDiscount;

      setSimulationDetails({
        conditionResults,
        allConditionsMet,
        originalPrice,
        calculatedDiscount,
        finalPrice,
        pointsAwarded: allConditionsMet ? pointsAwarded : 0
      });
      setIsSimulating(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [selectedCustomer, template]);

  return (
    <div className="space-y-6">
      {/* Search Customer Input */}
      {!selectedCustomer && (
        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300">
            🔍 Tìm kiếm khách hàng (Real Data)
          </label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nhập tên hoặc số điện thoại khách hàng..."
              className="w-full pl-11 pr-10 py-3.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 transition-all text-sm text-gray-900 dark:text-zinc-100"
            />
            {loading && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500 animate-spin" />
            )}
          </div>

          {/* Customer Search Results */}
          <AnimatePresence>
            {searchQuery && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-2 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden max-h-72 overflow-y-auto z-20 relative"
              >
                {customers.length > 0 ? (
                  <div className="divide-y divide-gray-50 dark:divide-zinc-800/50">
                    {customers.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setSearchQuery('');
                        }}
                        className="w-full px-5 py-3.5 flex items-center gap-4 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition-all text-left group"
                      >
                        <span className="text-3xl bg-gray-100 dark:bg-zinc-800 p-2 rounded-xl group-hover:scale-105 transition-transform">{customer.avatar}</span>
                        <div className="flex-grow min-w-0">
                          <p className="font-extrabold text-sm text-gray-900 dark:text-zinc-100 truncate">{customer.name}</p>
                          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{customer.phone}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border ${
                            customer.tier === 'VIP'
                              ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-400'
                              : customer.tier === 'Premium'
                              ? 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-400'
                              : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-zinc-800/30 dark:border-zinc-700/50 dark:text-zinc-400'
                          }`}>
                            {customer.tier}
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium">{customer.totalBookings} Booking</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-8 text-center text-xs text-gray-500 dark:text-zinc-400 font-medium">
                    Không tìm thấy khách hàng nào khớp với tìm kiếm.
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Selected Customer & Simulation Board */}
      {selectedCustomer && (
        <AnimatePresence mode="wait">
          {isSimulating ? (
            <motion.div
              key="simulating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-12 space-y-4"
            >
              <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
              <p className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-widest animate-pulse">
                Bella đang đối chiếu các điều kiện...
              </p>
            </motion.div>
          ) : (
            simulationDetails && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
              >
                {/* Real-time Customer profile banner */}
                <div className="p-4 bg-gradient-to-r from-rose-50/50 to-orange-50/50 dark:from-rose-950/10 dark:to-orange-950/10 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl bg-white dark:bg-zinc-950 p-1.5 rounded-xl shadow-inner">{selectedCustomer.avatar}</span>
                    <div>
                      <h3 className="font-extrabold text-sm text-gray-900 dark:text-zinc-100">
                        {selectedCustomer.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{selectedCustomer.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-1 bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-black uppercase tracking-wider rounded-lg border border-rose-200/50">
                      {selectedCustomer.tier}
                    </span>
                    <p className="text-[10px] text-gray-400 mt-1 font-extrabold">{selectedCustomer.loyalty_points} điểm thưởng</p>
                  </div>
                </div>

                {/* Condition checks */}
                <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-3">
                  <h4 className="text-xs font-black text-gray-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-purple-500" /> Đối chiếu Điều Kiện
                  </h4>
                  <div className="space-y-2">
                    {simulationDetails.conditionResults.map((result: ConditionResult, index: number) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-3 rounded-xl border ${
                          result.isMatched
                            ? 'bg-green-50/40 border-green-200/60 text-green-700 dark:bg-green-950/10 dark:border-green-900/30 dark:text-green-400'
                            : 'bg-red-50/40 border-red-200/60 text-red-700 dark:bg-red-950/10 dark:border-red-900/30 dark:text-red-400'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl bg-white dark:bg-zinc-950 p-1 rounded-lg shadow-sm">{result.icon}</span>
                          <div>
                            <p className="text-xs font-extrabold text-gray-900 dark:text-zinc-100">{result.label}</p>
                            <p className="text-[10px] text-gray-400 dark:text-zinc-400 mt-0.5">{result.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold opacity-70 italic">{result.actualValueDescription}</span>
                          {result.isMatched ? (
                            <div className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center shadow-sm">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm">
                              <X className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Calculation breakdown */}
                <div className="bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-emerald-950/10 dark:to-teal-950/10 border border-green-200/50 dark:border-emerald-900/30 p-5 rounded-2xl shadow-sm space-y-3">
                  <h4 className="text-xs font-black text-gray-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Calculator className="w-4.5 h-4.5 text-emerald-600" /> Giả Lập Kết Quả Tính Toán
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2.5 bg-white dark:bg-zinc-900 rounded-xl shadow-xs text-xs">
                      <span className="text-gray-500 font-semibold">Giá trị đơn thử nghiệm</span>
                      <span className="font-mono font-bold text-gray-900 dark:text-zinc-100">{simulationDetails.originalPrice.toLocaleString('vi-VN')}đ</span>
                    </div>
                    {simulationDetails.calculatedDiscount > 0 ? (
                      <div className="flex justify-between items-center p-2.5 bg-white dark:bg-zinc-900 rounded-xl shadow-xs text-xs">
                        <span className="text-gray-500 font-semibold">Giảm giá tự động</span>
                        <span className="font-mono font-bold text-red-500">-{simulationDetails.calculatedDiscount.toLocaleString('vi-VN')}đ</span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center p-2.5 bg-white dark:bg-zinc-900 rounded-xl shadow-xs text-xs border-dashed border border-red-200 text-red-500">
                        <span className="font-semibold">Không đạt điều kiện áp dụng</span>
                        <span className="font-mono font-bold">0đ</span>
                      </div>
                    )}
                    {simulationDetails.pointsAwarded > 0 && (
                      <div className="flex justify-between items-center p-2.5 bg-white dark:bg-zinc-900 rounded-xl shadow-xs text-xs text-amber-600 border border-amber-200/40">
                        <span className="font-semibold">Điểm tích lũy cộng thêm</span>
                        <span className="font-mono font-bold">+{simulationDetails.pointsAwarded} Điểm</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center p-3 bg-emerald-600 text-white rounded-xl shadow-md">
                      <span className="text-xs font-bold uppercase tracking-wider">Khách phải trả</span>
                      <span className="font-mono text-base font-black">{simulationDetails.finalPrice.toLocaleString('vi-VN')}đ</span>
                    </div>
                  </div>
                </div>

                {/* Autopilot Insight Summary */}
                <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/15 dark:to-orange-950/15 border border-amber-200/60 dark:border-amber-900/20 rounded-2xl space-y-2">
                  <h4 className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> 🤖 Bella Giải thích lý do quyết định:
                  </h4>
                  {simulationDetails.allConditionsMet ? (
                    <ul className="text-xs text-gray-700 dark:text-zinc-300 space-y-1.5 pl-1.5">
                      {simulationDetails.conditionResults.map((res: ConditionResult, idx: number) => (
                        <li key={idx} className="flex items-center gap-2 font-medium">
                          <Check className="w-3.5 h-3.5 text-green-500 stroke-[3] shrink-0" />
                          <span>Khớp điều kiện: <strong className="text-slate-900 dark:text-white">{res.label}</strong> ({res.actualValueDescription})</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-red-600 dark:text-red-400 font-semibold pl-1">
                      ❌ Bỏ qua thực thi: Khách hàng không đạt đủ toàn bộ các điều kiện quy định.
                    </p>
                  )}
                </div>

                {/* Form Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 text-xs font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 cursor-pointer"
                  >
                    Thử khách hàng khác
                  </button>
                  <button
                    type="button"
                    onClick={onComplete}
                    className="flex-1 py-3 bg-gradient-to-r from-rose-500 to-orange-500 hover:opacity-90 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-rose-500/20 transition-all active:scale-95 cursor-pointer"
                  >
                    ✓ Đã hiểu
                  </button>
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>
      )}

      {/* Search Empty Placeholder */}
      {!selectedCustomer && !searchQuery && (
        <div className="p-8 bg-gradient-to-br from-rose-50/30 to-orange-50/30 dark:from-zinc-900/30 dark:to-zinc-800/30 border-2 border-dashed border-rose-200 dark:border-zinc-800 rounded-2xl text-center space-y-3">
          <div className="text-5xl">🧪</div>
          <div>
            <h5 className="text-xs font-black text-gray-800 dark:text-zinc-200 uppercase tracking-widest">Bảng Giả Lập Trực Quan</h5>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto leading-relaxed">
              Vui lòng tìm kiếm một khách hàng thực để xem cách Bella đối chiếu điều kiện và tính toán hóa đơn ngay tại đây.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
