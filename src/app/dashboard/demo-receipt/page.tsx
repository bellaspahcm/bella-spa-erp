"use client";

import React, { useRef, useState } from "react";
import { PaymentReceiptTemplate, ReceiptData } from "@/components/common/PaymentReceiptTemplate";
import { toPng } from "html-to-image";
import { Download, Loader2 } from "lucide-react";

export default function DemoReceiptPage() {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Mock data for previewing a generic spa receipt.
  const mockData: ReceiptData = {
    customerName: "Khách Beauty Demo",
    phone: "0908669901",
    address: "Quận 1, TP. Hồ Chí Minh",
    serviceNote: "Facial cấp ẩm chuyên sâu (Bắt đầu gói từ 10/6/2026)",
    items: [
      {
        id: 1,
        name: "Facial cấp ẩm chuyên sâu",
        sessions: 30,
        unitPrice: 150000,
        total: 4500000,
        discountNote: "Tặng 2 buổi",
        prepaid: null,
        finalPayment: 4500000,
      },
    ],
    totalAmount: 4500000,
    bankInfo: {
      ownerName: "Cao Thị Thúy Vân",
      accountNumber: "8832041471",
      bankName: "Ngân hàng BIDV",
    },
  };

  const handleExport = async () => {
    if (!receiptRef.current) return;
    
    try {
      setIsExporting(true);
      
      // We scale up to get a high quality image
      const dataUrl = await toPng(receiptRef.current, { 
        quality: 1, 
        pixelRatio: 2,
        // style: { transform: 'scale(1)', transformOrigin: 'top left' }
      });
      
      const link = document.createElement("a");
      link.download = `Bao_Gia_${mockData.customerName.replace(/\s+/g, "_")}.png`;
      link.href = dataUrl;
      link.click();
      
    } catch (err) {
      console.error("Failed to export image", err);
      alert("Có lỗi xảy ra khi xuất ảnh. Vui lòng thử lại!");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-8 pb-20">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Demo Tạo Báo Giá / Phiếu Thanh Toán</h1>
          <p className="text-gray-500">Xem trước và xuất ảnh mô phỏng theo mẫu thiết kế cung cấp.</p>
        </div>
        
        <button 
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 bg-[#e95e87] hover:bg-[#d84873] text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-70"
        >
          {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          {isExporting ? "Đang xuất ảnh..." : "Xuất File PNG"}
        </button>
      </div>

      {/* Wrapping in a container with overflow auto so it scrolls on small screens rather than squishing */}
      <div className="bg-gray-100 p-8 rounded-xl border border-gray-200 overflow-auto">
        <div className="flex justify-center min-w-[1200px]">
          <PaymentReceiptTemplate ref={receiptRef} data={mockData} />
        </div>
      </div>
    </div>
  );
}
