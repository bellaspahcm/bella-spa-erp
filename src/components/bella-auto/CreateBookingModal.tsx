'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Plus } from 'lucide-react';

interface CreateBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateBookingModal({ isOpen, onClose }: CreateBookingModalProps) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  <div>
                    <Dialog.Title className="text-xl font-bold text-slate-900 dark:text-white">
                      Tạo Booking Mới
                    </Dialog.Title>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Tạo đơn đặt cọc xe cho khách hàng
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                {/* Body - Coming Soon */}
                <div className="p-8 text-center">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-950 dark:to-blue-950 flex items-center justify-center">
                    <Plus className="w-10 h-10 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                    Tính Năng Đang Phát Triển
                  </h3>
                  
                  <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
                    Form tạo booking mới đang được phát triển. Tính năng này sẽ cho phép bạn:
                  </p>

                  <ul className="text-left max-w-md mx-auto space-y-3 mb-8">
                    <li className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
                      <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Chọn khách hàng hoặc tạo khách hàng mới</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
                      <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Chọn dòng xe, màu sắc và phiên bản</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
                      <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Phân bổ VIN từ kho (nếu có sẵn)</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
                      <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Thiết lập giá bán và số tiền cọc yêu cầu</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
                      <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Xác nhận thanh toán cọc ngay (nếu có)</span>
                    </li>
                  </ul>

                  <button
                    onClick={onClose}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                  >
                    Đóng
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
