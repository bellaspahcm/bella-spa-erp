'use client';

import React, { useState, useEffect } from 'react';
import { Camera, Eye, FileText, CheckCircle, Clock, ExternalLink, Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { 
  getImagingOrdersAction, 
  createImagingOrderAction, 
  verifyImagingResultAction 
} from '@/services/healthcare/healthcare-actions';

interface ImagingWorkItem {
  id: string;
  ticketNumber: string;
  patientName: string;
  modality: 'XRAY' | 'CT' | 'MRI' | 'ULTRASOUND' | 'ENDOSCOPY';
  bodySite: string;
  dcmStudyUid: string;
  viewerLink: string;
  status: 'pending' | 'captured' | 'reported';
  radiologistReport?: string;
}

export default function ImagingPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<ImagingWorkItem[]>([]);

  const [newImaging, setNewImaging] = useState({
    patientName: '',
    modality: 'XRAY' as ImagingWorkItem['modality'],
    bodySite: 'X-Quang Ngực Thẳng (Chest AP)',
  });

  const loadImagingOrders = async () => {
    try {
      setIsLoading(true);
      const res = await getImagingOrdersAction();
      if (res.success && res.data) {
        setItems(res.data as ImagingWorkItem[]);
      } else {
        toast.error('Lỗi tải phiếu CĐHA: ' + res.error);
      }
    } catch (err) {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadImagingOrders();
  }, []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reportText, setReportText] = useState('');

  const handleCreateImagingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImaging.patientName.trim()) {
      toast.error('Vui lòng nhập tên bệnh nhân chỉ định CĐHA!');
      return;
    }

    const dbRes = await createImagingOrderAction({
      patientName: newImaging.patientName.trim(),
      modality: newImaging.modality,
      bodySite: newImaging.bodySite,
    });

    if (!dbRes.success) {
      toast.error('Lỗi tạo chỉ định CĐHA: ' + dbRes.error);
      return;
    }

    setIsAddModalOpen(false);
    toast.success(`🎉 Đã khởi tạo phiếu CĐHA ${newImaging.modality} cho bệnh nhân ${newImaging.patientName.trim()}!`);
    setNewImaging({ patientName: '', modality: 'XRAY', bodySite: 'X-Quang Ngực Thẳng (Chest AP)' });
    loadImagingOrders();
  };

  const handleSaveReport = async (id: string) => {
    if (!reportText) {
      toast.error('Vui lòng nhập nội dung báo cáo chẩn đoán!');
      return;
    }

    const dbRes = await verifyImagingResultAction(id, reportText);
    if (!dbRes.success) {
      toast.error('Lỗi lưu báo cáo CĐHA: ' + dbRes.error);
      return;
    }

    toast.success('🎉 Đã duyệt & lưu Báo cáo Chẩn đoán Hình ảnh thành công!');
    setSelectedId(null);
    setReportText('');
    loadImagingOrders();
  };

  const filteredItems = items.filter((item) =>
    item.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.bodySite.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 w-full space-y-7 bg-transparent relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Camera className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Phân Hệ Chẩn Đoán Hình Ảnh (RIS Engine & DICOM PACS)
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Quản lý Ca chụp X-Quang/CT/MRI/Siêu âm, Viewer DICOM PACS & Kết xuất Báo cáo Chẩn đoán.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-md flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
          >
            <Camera className="w-4 h-4" />
            + Chỉ Định CĐHA RIS PACS
          </button>
          <button
            onClick={() => toast.info('Đang kết nối Server PACS DICOM...')}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-indigo-500" />
            Kết nối Server PACS
          </button>
        </div>
      </div>

      {/* Quick Stat Counter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">Tổng Ca Chụp CĐHA</span>
            <span className="text-xl font-black text-slate-900 dark:text-white mt-0.5 block">{items.length} ca chỉ định</span>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600">
            <Camera className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">Chờ Bác Sĩ Đọc Kết Quả</span>
            <span className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5 block">
              {items.filter((i) => i.status !== 'reported').length} ca chờ đọc
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">Đã Duyệt Báo Cáo</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
              {items.filter((i) => i.status === 'reported').length} ca hoàn tất
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">Kết Nối Server PACS</span>
            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5 block">100% Ready (DICOM)</span>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600">
            <ExternalLink className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm tên bệnh nhân, loại chụp..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* RIS Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => (
          <div key={item.id} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4 hover:border-indigo-500/50 transition-all shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-extrabold text-[10px]">
                  {item.ticketNumber} • {item.modality}
                </span>
                {item.status === 'reported' ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Đã đọc
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Chờ đọc
                  </span>
                )}
              </div>

              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-base">{item.patientName}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{item.bodySite}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-mono">DICOM Study UID</span>
                  <a
                    href={item.viewerLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
                  >
                    Xem phim DICOM <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {item.radiologistReport && (
                <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-800/30 text-xs text-slate-700 dark:text-slate-300">
                  <span className="font-bold block text-[10px] text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">
                    Báo cáo Chẩn đoán
                  </span>
                  {item.radiologistReport}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              {selectedId === item.id ? (
                <div className="space-y-2">
                  <textarea
                    rows={3}
                    placeholder="Nhập nội dung báo cáo chẩn đoán hình ảnh..."
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    className="w-full p-2 text-xs rounded-xl border border-indigo-500 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setSelectedId(null)}
                      className="px-3 py-1 rounded-lg text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={() => handleSaveReport(item.id)}
                      className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-indigo-600 shadow-sm"
                    >
                      Lưu Báo Cáo
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setSelectedId(item.id); setReportText(item.radiologistReport || ''); }}
                  className="w-full py-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:bg-indigo-500 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {item.radiologistReport ? 'Cập nhật Báo cáo' : 'Viết Báo cáo CĐHA'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal Chỉ Định CĐHA RIS PACS Mới */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg p-6 space-y-5 animate-in fade-in zoom-in duration-200 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-600" />
                Khởi Tạo Phiếu Chỉ Định CĐHA RIS PACS
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateImagingSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Tên Bệnh Nhân *</label>
                <input
                  type="text"
                  required
                  placeholder="Nhập tên bệnh nhân..."
                  value={newImaging.patientName}
                  onChange={(e) => setNewImaging({ ...newImaging, patientName: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Phương Pháp Chẩn Đoán (Modality)</label>
                <select
                  value={newImaging.modality}
                  onChange={(e) => {
                    const mod = e.target.value as any;
                    let site = 'X-Quang Ngực Thẳng (Chest AP)';
                    if (mod === 'CT') site = 'CT-Scanner Sọ Não Không Tiêm Thuốc';
                    else if (mod === 'MRI') site = 'MRI Cột Sống Thắt Lưng (L-Spine)';
                    else if (mod === 'ULTRASOUND') site = 'Siêu âm Ổ bụng tổng quát';
                    else if (mod === 'ENDOSCOPY') site = 'Nội soi Dạ dày - Tá tràng';

                    setNewImaging({ ...newImaging, modality: mod, bodySite: site });
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-bold text-slate-900 dark:text-white"
                >
                  <option value="XRAY">XRAY — X-Quang Kỹ Thuật Số (CR/DR)</option>
                  <option value="CT">CT — CT-Scanner Cắt Lớp Vi Tính</option>
                  <option value="MRI">MRI — Chụp Cộng Hưởng Từ</option>
                  <option value="ULTRASOUND">ULTRASOUND — Siêu Âm Đa Khoa 4D</option>
                  <option value="ENDOSCOPY">ENDOSCOPY — Nội Soi Tiêu Hóa</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Mô Tả Vị Trí & Chỉ Định Chụp</label>
                <input
                  type="text"
                  required
                  value={newImaging.bodySite}
                  onChange={(e) => setNewImaging({ ...newImaging, bodySite: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-semibold text-indigo-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer">
                  Hủy Bỏ
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md cursor-pointer active:scale-95 transition-all">
                  + Chỉ Định CĐHA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
