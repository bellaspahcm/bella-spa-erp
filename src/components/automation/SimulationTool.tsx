/**
 * Automation Studio - SimulationTool Component
 * 
 * Allows users to test automation with real customer data before saving.
 * 
 * UX Flow:
 * 1. Search for a customer
 * 2. Display customer data (tier, booking history, etc.)
 * 3. Show condition validation (✓ Khách VIP, ✓ Booking >2tr)
 * 4. Show exact calculation results (2.5M → -500k → 2M)
 * 5. "Explain Why" section (Bella làm vậy vì...)
 * 
 * NOTE: This is a placeholder for Sprint 3 implementation.
 * 
 * @author Automation Studio Team
 * @date 2026-07-09
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Check, X, Sparkles, Calculator } from 'lucide-react';
import type { AutomationTemplate } from '@/lib/automation/templates';

interface SimulationToolProps {
  template: AutomationTemplate;
  onComplete?: () => void;
}

export function SimulationTool({ template, onComplete }: SimulationToolProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  // TODO: Integrate with real customer API
  const mockCustomers = [
    { id: '1', name: 'Nguyễn Thị Lan', phone: '0901234567', tier: 'VIP', avatar: '👩' },
    { id: '2', name: 'Trần Văn An', phone: '0907654321', tier: 'Regular', avatar: '👨' },
    { id: '3', name: 'Lê Thị Mai', phone: '0912345678', tier: 'New', avatar: '👩' },
  ];

  const filteredCustomers = mockCustomers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      {/* Search Customer */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          🔍 Tìm khách hàng để thử nghiệm
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên hoặc số điện thoại..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Customer Results */}
        {searchQuery && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
          >
            {filteredCustomers.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setSearchQuery('');
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-purple-50 transition-colors text-left"
                  >
                    <span className="text-3xl">{customer.avatar}</span>
                    <div className="flex-grow">
                      <p className="font-medium text-gray-900">{customer.name}</p>
                      <p className="text-sm text-gray-500">{customer.phone}</p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-md ${
                        customer.tier === 'VIP'
                          ? 'bg-purple-100 text-purple-700'
                          : customer.tier === 'Regular'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {customer.tier}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-gray-500">
                Không tìm thấy khách hàng
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Selected Customer Simulation */}
      {selectedCustomer && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4"
        >
          {/* Customer Card */}
          <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-4xl">{selectedCustomer.avatar}</span>
              <div className="flex-grow">
                <h3 className="font-semibold text-gray-900 text-lg">
                  {selectedCustomer.name}
                </h3>
                <p className="text-sm text-gray-600">{selectedCustomer.phone}</p>
              </div>
              <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-lg">
                {selectedCustomer.tier}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-white rounded-lg">
                <p className="text-xs text-gray-500">Booking</p>
                <p className="text-lg font-bold text-gray-900">12</p>
              </div>
              <div className="p-2 bg-white rounded-lg">
                <p className="text-xs text-gray-500">Tổng chi</p>
                <p className="text-lg font-bold text-gray-900">15M</p>
              </div>
              <div className="p-2 bg-white rounded-lg">
                <p className="text-xs text-gray-500">Rating</p>
                <p className="text-lg font-bold text-gray-900">4.8⭐</p>
              </div>
            </div>
          </div>

          {/* Condition Validation */}
          <div className="p-4 bg-white border border-gray-200 rounded-xl">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>📋</span>
              Kiểm tra điều kiện
            </h4>
            <div className="space-y-2">
              {template.conditions.map((condition, index) => {
                // TODO: Real validation logic in Sprint 3
                const isMatched = Math.random() > 0.3;
                return (
                  <div
                    key={index}
                    className={`flex items-center gap-2 p-2 rounded-lg ${
                      isMatched
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {isMatched ? (
                      <Check className="w-5 h-5 flex-shrink-0" />
                    ) : (
                      <X className="w-5 h-5 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium">{condition.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Calculation Results */}
          <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Kết quả tính toán
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-white rounded-lg">
                <span className="text-sm text-gray-600">Giá trị booking</span>
                <span className="font-mono font-bold text-gray-900">2.500.000 VNĐ</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white rounded-lg">
                <span className="text-sm text-gray-600">Giảm giá (15%)</span>
                <span className="font-mono font-bold text-red-600">-375.000 VNĐ</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-green-100 rounded-lg border-2 border-green-500">
                <span className="text-sm font-medium text-green-800">Tổng sau giảm</span>
                <span className="font-mono font-bold text-green-800">2.125.000 VNĐ</span>
              </div>
            </div>
          </div>

          {/* Explain Why */}
          <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-600" />
              🤖 Bella làm vậy vì:
            </h4>
            <ul className="space-y-1">
              {template.conditions.map((condition, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>{condition.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setSelectedCustomer(null)}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
            >
              Thử khách khác
            </button>
            <button
              onClick={onComplete}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all"
            >
              ✓ Đã hiểu
            </button>
          </div>
        </motion.div>
      )}

      {/* Empty State */}
      {!selectedCustomer && (
        <div className="p-8 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-dashed border-purple-300 rounded-2xl text-center">
          <div className="text-6xl mb-3">🔍</div>
          <p className="text-gray-600 mb-2">Chọn khách hàng để thử nghiệm</p>
          <p className="text-sm text-gray-500">
            Bella sẽ cho bạn xem automation chạy như thế nào với dữ liệu thật
          </p>
        </div>
      )}
    </div>
  );
}
