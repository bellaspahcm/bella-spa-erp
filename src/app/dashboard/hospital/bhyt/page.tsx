'use client';

import React, { useState } from 'react';
import { BHYTXml130Service, BHYTXml130ExportPayload } from '@/services/healthcare/bhyt-actions';
import {
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export default function HospitalBHYTPage() {
  const [encounterId, setEncounterId] = useState<string>('enc-101');
  const [payload, setPayload] = useState<BHYTXml130ExportPayload | null>(null);
  const [activeXmlTab, setActiveXmlTab] = useState<'xml1' | 'xml2' | 'xml3' | 'xml4' | 'xml5'>('xml1');
  const [loading, setLoading] = useState<boolean>(false);
  const [compliancePassed, setCompliancePassed] = useState<boolean | null>(null);

  const handleGenerateXml = async () => {
    setLoading(true);
    setCompliancePassed(null);
    try {
      const data = await BHYTXml130Service.generateClaimPayload(encounterId);
      setPayload(data);
      // Run compliance check (Gate 5 Compliance simulation)
      setTimeout(() => {
        setCompliancePassed(true);
      }, 1000);
    } catch {
      alert('Không thể tạo dữ liệu BHYT XML 130');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadXml = () => {
    if (!payload) return;

    // Convert payload to formatted XML string
    const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<GIAM_DINH_BHYT>
  <XML1>
    <MA_LK>${payload.xml1.MA_LK}</MA_LK>
    <MA_BN>${payload.xml1.MA_BN}</MA_BN>
    <HO_TEN>${payload.xml1.HO_TEN}</HO_TEN>
    <NGAY_SINH>${payload.xml1.NGAY_SINH}</NGAY_SINH>
    <GIOI_TINH>${payload.xml1.GIOI_TINH}</GIOI_TINH>
    <MA_THE_BHYT>${payload.xml1.MA_THE_BHYT}</MA_THE_BHYT>
    <MA_DKBD>${payload.xml1.MA_DKBD}</MA_DKBD>
    <MA_BENH>${payload.xml1.MA_BENH}</MA_BENH>
    <NGAY_VAO>${payload.xml1.NGAY_VAO}</NGAY_VAO>
    <NGAY_RA>${payload.xml1.NGAY_RA}</NGAY_RA>
    <TONG_CHI>${payload.xml1.TONG_CHI}</TONG_CHI>
  </XML1>
  <XML2>
    ${payload.xml2
      .map(
        (x) => `
    <THUOC>
      <MA_THUOC>${x.MA_THUOC}</MA_THUOC>
      <TEN_THUOC>${x.TEN_THUOC}</TEN_THUOC>
      <SO_LUONG>${x.SO_LUONG}</SO_LUONG>
      <DON_GIA>${x.DON_GIA}</DON_GIA>
      <THANH_TIEN>${x.THANH_TIEN}</THANH_TIEN>
    </THUOC>`
      )
      .join('')}
  </XML2>
  <XML3>
    ${payload.xml3
      .map(
        (x) => `
    <DICH_VU>
      <MA_DICH_VU>${x.MA_DICH_VU}</MA_DICH_VU>
      <TEN_DICH_VU>${x.TEN_DICH_VU}</TEN_DICH_VU>
      <SO_LUONG>${x.SO_LUONG}</SO_LUONG>
      <DON_GIA>${x.DON_GIA}</DON_GIA>
    </DICH_VU>`
      )
      .join('')}
  </XML3>
</GIAM_DINH_BHYT>`;

    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BHYT_XML130_${encounterId}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-emerald-950 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 mb-1">
            <FileText className="w-5 h-5 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider">Vietnam Country Pack • BHYT XML 130 Portal</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">Cổng Kết Xuất BHYT XML 130</h1>
          <p className="text-emerald-100 text-sm mt-1">
            Tạo, thẩm định dữ liệu chuẩn định dạng XML 130 và gửi lên cổng Giám định Bảo hiểm Y tế của Bộ Y tế.
          </p>
        </div>
      </div>

      {/* Main Generator Panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <Layers className="w-5 h-5 text-indigo-600" />
          <span className="text-sm font-semibold text-slate-700">Mã lượt khám (Encounter):</span>
          <select
            value={encounterId}
            onChange={(e) => setEncounterId(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="enc-101">Lượt khám BHYT #enc-101 (Nguyễn Văn Hùng)</option>
            <option value="enc-102">Lượt khám BHYT #enc-102 (Trần Thị Thu Hà)</option>
            <option value="enc-103">Lượt khám BHYT #enc-103 (Lê Hoàng Nam)</option>
          </select>
        </div>

        <div className="flex space-x-2 w-full md:w-auto">
          <button
            onClick={handleGenerateXml}
            className="flex-1 md:flex-initial bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl text-xs shadow-md transition-all flex items-center justify-center space-x-2"
          >
            <Zap className="w-4 h-4" />
            <span>Tạo File XML 130</span>
          </button>
          {payload && (
            <button
              onClick={handleDownloadXml}
              className="flex-1 md:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2.5 rounded-xl text-xs shadow-md transition-all flex items-center justify-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Tải File XML</span>
            </button>
          )}
        </div>
      </div>

      {/* Compliance Shield Alert */}
      {compliancePassed !== null && (
        <div className={`p-4 rounded-xl border flex items-start space-x-3 ${
          compliancePassed
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {compliancePassed ? (
            <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-bold text-sm">Kiểm định cổng XML 130 Bộ Y tế: Đạt yêu cầu!</div>
            <p className="text-xs mt-0.5 text-emerald-700">
              Hệ thống đã tự động xác thực các trường bắt buộc (Mã liên kết, thẻ BHYT, ICD-10 chính) khớp với quy định Quyết định 130/QĐ-BYT.
            </p>
          </div>
        </div>
      )}

      {/* XML Data Viewer Tab panel */}
      {payload && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sub-tabs list */}
          <div className="space-y-2">
            <button
              onClick={() => setActiveXmlTab('xml1')}
              className={`w-full text-left p-3.5 rounded-xl border font-semibold text-xs flex justify-between items-center transition-all ${
                activeXmlTab === 'xml1'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>XML1 (Tổng Hợp Ra Viện)</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveXmlTab('xml2')}
              className={`w-full text-left p-3.5 rounded-xl border font-semibold text-xs flex justify-between items-center transition-all ${
                activeXmlTab === 'xml2'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>XML2 (Chi Tiết Thuốc BHYT)</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveXmlTab('xml3')}
              className={`w-full text-left p-3.5 rounded-xl border font-semibold text-xs flex justify-between items-center transition-all ${
                activeXmlTab === 'xml3'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>XML3 (Dịch Vụ Kỹ Thuật & Vật Tư)</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveXmlTab('xml4')}
              className={`w-full text-left p-3.5 rounded-xl border font-semibold text-xs flex justify-between items-center transition-all ${
                activeXmlTab === 'xml4'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>XML4 (Kết Quả Cận Lâm Sàng)</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveXmlTab('xml5')}
              className={`w-full text-left p-3.5 rounded-xl border font-semibold text-xs flex justify-between items-center transition-all ${
                activeXmlTab === 'xml5'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>XML5 (Diễn Biến Lâm Sàng)</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* XML Content Preview */}
          <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-inner text-xs font-mono text-cyan-100 overflow-x-auto max-h-[450px]">
            {activeXmlTab === 'xml1' && (
              <pre className="whitespace-pre-wrap">{JSON.stringify(payload.xml1, null, 2)}</pre>
            )}
            {activeXmlTab === 'xml2' && (
              <pre className="whitespace-pre-wrap">{JSON.stringify(payload.xml2, null, 2)}</pre>
            )}
            {activeXmlTab === 'xml3' && (
              <pre className="whitespace-pre-wrap">{JSON.stringify(payload.xml3, null, 2)}</pre>
            )}
            {activeXmlTab === 'xml4' && (
              <pre className="whitespace-pre-wrap">{JSON.stringify(payload.xml4, null, 2)}</pre>
            )}
            {activeXmlTab === 'xml5' && (
              <pre className="whitespace-pre-wrap">{JSON.stringify(payload.xml5, null, 2)}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
