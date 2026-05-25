"use client";

import React, { forwardRef } from "react";
import { User, Phone, MapPin, Flower, CreditCard, Landmark } from "lucide-react";

export interface ReceiptItem {
  id: number;
  name: string;
  sessions: number;
  unitPrice: number;
  total: number;
  discountNote: string;
  prepaid: number | null;
  finalPayment: number;
}

export interface ReceiptData {
  customerName: string;
  phone: string;
  address: string;
  serviceNote: string;
  items: ReceiptItem[];
  totalAmount: number;
  bankInfo: {
    ownerName: string;
    accountNumber: string;
    bankName: string;
  };
}

interface PaymentReceiptTemplateProps {
  data: ReceiptData;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("vi-VN").format(amount);
};

export const PaymentReceiptTemplate = forwardRef<HTMLDivElement, PaymentReceiptTemplateProps>(
  ({ data }, ref) => {
    return (
      <div
        ref={ref}
        className="w-[1100px] min-h-[580px] p-8 rounded-2xl relative overflow-hidden bg-white bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/images/receipt-bg.png')",
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          boxShadow: "0 0 20px rgba(255, 182, 193, 0.3)",
        }}
      >
        {/* Decorative corner elements could go here as absolute positioned svgs */}

        <div className="flex flex-col items-center justify-center mb-6">
          <div className="mb-3">
            <img src="/images/logo.png" alt="Bella Spa Logo" className="h-24 object-contain" />
          </div>
          
          <h1 className="text-3xl font-bold text-[#e6396e] tracking-wide mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
            PHIẾU THÔNG TIN THANH TOÁN
          </h1>
          <div className="flex items-center justify-center w-full max-w-md">
            <div className="h-px bg-pink-300 flex-1"></div>
            <Flower className="w-4 h-4 text-pink-500 mx-2" />
            <div className="h-px bg-pink-300 flex-1"></div>
          </div>
        </div>

        {/* Customer Info Section */}
        <div className="border border-pink-200 bg-white/90 backdrop-blur-sm rounded-xl p-5 mb-5 shadow-sm">
          <div className="grid grid-cols-2 gap-y-4 gap-x-10">
            <div className="flex items-center text-sm">
              <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center mr-4 shrink-0 text-pink-500">
                <User size={16} />
              </div>
              <span className="w-32 text-gray-600">Họ tên khách hàng:</span>
              <span className="font-medium text-gray-800">{data.customerName}</span>
            </div>
            <div className="flex items-center text-sm">
              <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center mr-4 shrink-0 text-pink-500">
                <MapPin size={16} />
              </div>
              <span className="w-20 text-gray-600">Địa chỉ:</span>
              <span className="font-medium text-gray-800">{data.address}</span>
            </div>
            <div className="flex items-center text-sm">
              <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center mr-4 shrink-0 text-pink-500">
                <Phone size={16} />
              </div>
              <span className="w-32 text-gray-600">Số điện thoại:</span>
              <span className="font-medium text-gray-800">{data.phone}</span>
            </div>
            <div></div> {/* Empty column */}
            <div className="flex items-center text-sm col-span-2">
              <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center mr-4 shrink-0 text-pink-500">
                <Flower size={16} />
              </div>
              <span className="w-32 text-gray-600">Dịch vụ:</span>
              <span className="font-medium text-gray-800">{data.serviceNote}</span>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="border border-pink-200 bg-white rounded-xl overflow-hidden mb-6 shadow-sm">
          <table className="w-full text-sm text-center border-collapse">
            <thead>
              <tr className="bg-[#e95e87] text-white">
                <th className="py-3 px-2 font-medium border-r border-pink-300 border-b border-pink-200 w-16">STT</th>
                <th className="py-3 px-2 font-medium border-r border-pink-300 border-b border-pink-200">Tên DV</th>
                <th className="py-3 px-2 font-medium border-r border-pink-300 border-b border-pink-200">Liệu trình (Buổi)</th>
                <th className="py-3 px-2 font-medium border-r border-pink-300 border-b border-pink-200">Đơn giá (VND/Buổi)</th>
                <th className="py-3 px-2 font-medium border-r border-pink-300 border-b border-pink-200">Thành tiền</th>
                <th className="py-3 px-2 font-medium border-r border-pink-300 border-b border-pink-200">CTKM</th>
                <th className="py-3 px-2 font-medium border-r border-pink-300 border-b border-pink-200">Trả trước (VND)</th>
                <th className="py-3 px-2 font-medium border-b border-pink-200">Thanh toán (VND)</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, index) => (
                <tr key={item.id} className="text-gray-800">
                  <td className="py-4 px-2 border-r border-pink-100 border-b border-pink-100">{index + 1}</td>
                  <td className="py-4 px-2 border-r border-pink-100 border-b border-pink-100">{item.name}</td>
                  <td className="py-4 px-2 border-r border-pink-100 border-b border-pink-100">{item.sessions}</td>
                  <td className="py-4 px-2 border-r border-pink-100 border-b border-pink-100">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-4 px-2 border-r border-pink-100 border-b border-pink-100">{formatCurrency(item.total)}</td>
                  <td className="py-4 px-2 border-r border-pink-100 border-b border-pink-100">{item.discountNote}</td>
                  <td className="py-4 px-2 border-r border-pink-100 border-b border-pink-100">{item.prepaid ? formatCurrency(item.prepaid) : ""}</td>
                  <td className="py-4 px-2 border-b border-pink-100">{formatCurrency(item.finalPayment)}</td>
                </tr>
              ))}
              {/* Empty rows to match design */}
              <tr>
                <td className="py-4 px-2 border-r border-pink-100">&nbsp;</td>
                <td className="py-4 px-2 border-r border-pink-100">&nbsp;</td>
                <td className="py-4 px-2 border-r border-pink-100">&nbsp;</td>
                <td className="py-4 px-2 border-r border-pink-100">&nbsp;</td>
                <td className="py-4 px-2 border-r border-pink-100">&nbsp;</td>
                <td className="py-4 px-2 border-r border-pink-100">&nbsp;</td>
                <td className="py-4 px-2 border-r border-pink-100">&nbsp;</td>
                <td className="py-4 px-2">&nbsp;</td>
              </tr>
            </tbody>
          </table>
          
          {/* Total Row */}
          <div className="flex justify-end border-t border-pink-200">
            <div className="w-1/4"></div>
            <div className="flex w-1/2 justify-end p-2 pb-3 pr-3">
              <div className="flex items-center overflow-hidden rounded-md border border-pink-300 w-[350px]">
                <div className="bg-[#e95e87] text-white font-medium py-2 px-6 w-1/2 text-center">
                  Tổng TT (VND)
                </div>
                <div className="bg-white text-[#e95e87] font-bold py-2 px-6 w-1/2 text-center text-lg">
                  {formatCurrency(data.totalAmount)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bank Info Section */}
        <div className="inline-block border border-pink-200 bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm w-[60%]">
          <h3 className="text-[#e95e87] font-bold text-sm mb-3 flex items-center">
            <Flower size={14} className="mr-1" /> *Thông tin thanh toán
          </h3>
          <div className="flex items-center gap-6">
            <div className="flex items-center text-sm">
              <div className="w-10 h-10 rounded-full bg-[#e95e87] flex items-center justify-center mr-3 shrink-0 text-white shadow-sm">
                <User size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-500">Chủ tài khoản:</span>
                <span className="font-semibold text-gray-800">{data.bankInfo.ownerName}</span>
              </div>
            </div>
            
            <div className="flex items-center text-sm border-l border-pink-100 pl-6">
              <div className="w-10 h-10 rounded-full bg-[#e95e87] flex items-center justify-center mr-3 shrink-0 text-white shadow-sm">
                <CreditCard size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-500">Số tài khoản:</span>
                <span className="font-semibold text-gray-800">{data.bankInfo.accountNumber}</span>
              </div>
            </div>
            
            <div className="flex items-center text-sm border-l border-pink-100 pl-6">
              <div className="w-10 h-10 rounded-full bg-[#e95e87] flex items-center justify-center mr-3 shrink-0 text-white shadow-sm">
                <Landmark size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-500">Ngân hàng:</span>
                <span className="font-semibold text-gray-800">{data.bankInfo.bankName}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

PaymentReceiptTemplate.displayName = "PaymentReceiptTemplate";
