"use client";

import React, { forwardRef } from "react";
import { User, Phone, MapPin, Flower, CreditCard, Landmark } from "lucide-react";
import Image from "next/image";

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
        className="w-[1024px] h-[576px] p-6 rounded-2xl relative overflow-hidden bg-white bg-cover bg-center bg-no-repeat flex flex-col justify-between"
        style={{
          backgroundImage: "url('/images/receipt-bg.png')",
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          boxShadow: "0 0 20px rgba(255, 182, 193, 0.3)",
        }}
      >
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col justify-between">
          
          {/* Header */}
          <div className="flex flex-col items-center justify-center mb-3">
            <div className="mb-1">
              <Image src="/images/logo.png" alt="Bella Spa Logo" width={180} height={64} className="h-16 w-auto object-contain" />
            </div>
            
            <h1 className="text-2xl font-bold text-[#e6396e] tracking-wide mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
              PHIẾU THÔNG TIN THANH TOÁN
            </h1>
            <div className="flex items-center justify-center w-full max-w-sm">
              <div className="h-px bg-pink-300 flex-1"></div>
              <Flower className="w-3.5 h-3.5 text-pink-500 mx-2" />
              <div className="h-px bg-pink-300 flex-1"></div>
            </div>
          </div>

          {/* Customer Info Section */}
          <div className="border border-pink-200 bg-white/90 backdrop-blur-sm rounded-xl py-3 px-5 mb-3 shadow-sm">
            <div className="grid grid-cols-2 gap-y-2 gap-x-10">
              <div className="flex items-center text-xs">
                <div className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center mr-3 shrink-0 text-pink-500">
                  <User size={12} />
                </div>
                <span className="w-28 text-gray-600">Họ tên khách hàng:</span>
                <span className="font-medium text-gray-800">{data.customerName}</span>
              </div>
              <div className="flex items-center text-xs">
                <div className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center mr-3 shrink-0 text-pink-500">
                  <MapPin size={12} />
                </div>
                <span className="w-16 text-gray-600">Địa chỉ:</span>
                <span className="font-medium text-gray-800">{data.address}</span>
              </div>
              <div className="flex items-center text-xs">
                <div className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center mr-3 shrink-0 text-pink-500">
                  <Phone size={12} />
                </div>
                <span className="w-28 text-gray-600">Số điện thoại:</span>
                <span className="font-medium text-gray-800">{data.phone}</span>
              </div>
              <div></div> {/* Empty column */}
              <div className="flex items-center text-xs col-span-2">
                <div className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center mr-3 shrink-0 text-pink-500">
                  <Flower size={12} />
                </div>
                <span className="w-28 text-gray-600">Dịch vụ:</span>
                <span className="font-medium text-gray-800">{data.serviceNote}</span>
              </div>
            </div>
          </div>

          {/* Table Section */}
          <div className="border border-pink-200 bg-white rounded-xl overflow-hidden mb-3 shadow-sm">
            <table className="w-full text-xs text-center border-collapse">
              <thead>
                <tr className="bg-[#e95e87] text-white">
                  <th className="py-2 px-1 font-medium border-r border-pink-300 border-b border-pink-200 w-12">STT</th>
                  <th className="py-2 px-1 font-medium border-r border-pink-300 border-b border-pink-200">Tên DV</th>
                  <th className="py-2 px-1 font-medium border-r border-pink-300 border-b border-pink-200 w-28">Liệu trình (Buổi)</th>
                  <th className="py-2 px-1 font-medium border-r border-pink-300 border-b border-pink-200">Đơn giá (VND/Buổi)</th>
                  <th className="py-2 px-1 font-medium border-r border-pink-300 border-b border-pink-200">Thành tiền</th>
                  <th className="py-2 px-1 font-medium border-r border-pink-300 border-b border-pink-200">CTKM</th>
                  <th className="py-2 px-1 font-medium border-r border-pink-300 border-b border-pink-200">Trả trước (VND)</th>
                  <th className="py-2 px-1 font-medium border-b border-pink-200">Thanh toán (VND)</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => (
                  <tr key={item.id} className="text-gray-800">
                    <td className="py-2.5 px-1 border-r border-pink-100 border-b border-pink-100">{index + 1}</td>
                    <td className="py-2.5 px-1 border-r border-pink-100 border-b border-pink-100">{item.name}</td>
                    <td className="py-2.5 px-1 border-r border-pink-100 border-b border-pink-100">{item.sessions}</td>
                    <td className="py-2.5 px-1 border-r border-pink-100 border-b border-pink-100">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-2.5 px-1 border-r border-pink-100 border-b border-pink-100">{formatCurrency(item.total)}</td>
                    <td className="py-2.5 px-1 border-r border-pink-100 border-b border-pink-100">{item.discountNote}</td>
                    <td className="py-2.5 px-1 border-r border-pink-100 border-b border-pink-100">{item.prepaid ? formatCurrency(item.prepaid) : ""}</td>
                    <td className="py-2.5 px-1 border-b border-pink-100">{formatCurrency(item.finalPayment)}</td>
                  </tr>
                ))}
                {/* Slimmer empty rows to match design ratio */}
                <tr>
                  <td className="py-2 px-1 border-r border-pink-100">&nbsp;</td>
                  <td className="py-2 px-1 border-r border-pink-100">&nbsp;</td>
                  <td className="py-2 px-1 border-r border-pink-100">&nbsp;</td>
                  <td className="py-2 px-1 border-r border-pink-100">&nbsp;</td>
                  <td className="py-2 px-1 border-r border-pink-100">&nbsp;</td>
                  <td className="py-2 px-1 border-r border-pink-100">&nbsp;</td>
                  <td className="py-2 px-1 border-r border-pink-100">&nbsp;</td>
                  <td className="py-2 px-1">&nbsp;</td>
                </tr>
              </tbody>
            </table>
            
            {/* Total Row */}
            <div className="flex justify-end border-t border-pink-200">
              <div className="w-1/4"></div>
              <div className="flex w-1/2 justify-end p-1.5 pb-2 pr-2">
                <div className="flex items-center overflow-hidden rounded-md border border-pink-300 w-[280px]">
                  <div className="bg-[#e95e87] text-white font-medium py-1.5 px-4 w-1/2 text-center text-xs">
                    Tổng TT (VND)
                  </div>
                  <div className="bg-white text-[#e95e87] font-bold py-1.5 px-4 w-1/2 text-center text-sm">
                    {formatCurrency(data.totalAmount)}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Bank Info Section at the bottom */}
        <div className="inline-block border border-pink-200 bg-white/80 backdrop-blur-sm rounded-xl py-2.5 px-4 shadow-sm w-[60%] self-start mb-2">
          <h3 className="text-[#e95e87] font-bold text-xs mb-2 flex items-center">
            <Flower size={12} className="mr-1" /> *Thông tin thanh toán
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center text-xs">
              <div className="w-7 h-7 rounded-full bg-[#e95e87] flex items-center justify-center mr-2 shrink-0 text-white shadow-sm">
                <User size={12} />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-gray-500 leading-tight">Chủ tài khoản:</span>
                <span className="font-bold text-gray-800 leading-tight">{data.bankInfo.ownerName}</span>
              </div>
            </div>
            
            <div className="flex items-center text-xs border-l border-pink-100 pl-4">
              <div className="w-7 h-7 rounded-full bg-[#e95e87] flex items-center justify-center mr-2 shrink-0 text-white shadow-sm">
                <CreditCard size={12} />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-gray-500 leading-tight">Số tài khoản:</span>
                <span className="font-bold text-gray-800 leading-tight">{data.bankInfo.accountNumber}</span>
              </div>
            </div>
            
            <div className="flex items-center text-xs border-l border-pink-100 pl-4">
              <div className="w-7 h-7 rounded-full bg-[#e95e87] flex items-center justify-center mr-2 shrink-0 text-white shadow-sm">
                <Landmark size={12} />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-gray-500 leading-tight">Ngân hàng:</span>
                <span className="font-bold text-gray-800 leading-tight">{data.bankInfo.bankName}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    );
  }
);

PaymentReceiptTemplate.displayName = "PaymentReceiptTemplate";
