'use client';
import React, { useState } from 'react';
import { Activity, Plus, Search, CheckCircle, Clock, Calendar, Check, Play, User } from 'lucide-react';
import { toast } from 'sonner';

interface Milestone {
  readonly id: string;
  readonly name: string;
  readonly status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

interface SubJourney {
  readonly id: string;
  readonly name: string;
  readonly status: 'pending' | 'active' | 'completed';
  readonly milestones: Milestone[];
}

interface CareJourney {
  readonly id: string;
  readonly patientName: string;
  readonly type: string;
  readonly status: 'active' | 'paused' | 'completed' | 'cancelled';
  readonly startedAt: string;
  readonly subJourneys: SubJourney[];
}

export default function JourneysPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>('journey-01');

  // Form states
  const [patientName, setPatientName] = useState('');
  const [journeyType, setJourneyType] = useState('implant_care');

  const [journeys, setJourneys] = useState<CareJourney[]>([
    {
      id: 'journey-01',
      patientName: 'Nguyễn Văn Hùng',
      type: 'Cấy ghép Implant răng #36',
      status: 'active',
      startedAt: '2026-06-01',
      subJourneys: [
        {
          id: 'sj-01',
          name: 'Phẫu thuật cấy ghép trụ',
          status: 'completed',
          milestones: [
            { id: 'ms-11', name: 'Chụp phim CBCT & Lên phác đồ', status: 'completed' },
            { id: 'ms-12', name: 'Phẫu thuật cắm trụ Implant', status: 'completed' },
            { id: 'ms-13', name: 'Cắt chỉ sau 7-10 ngày', status: 'completed' },
          ],
        },
        {
          id: 'sj-02',
          name: 'Chờ tích hợp xương',
          status: 'active',
          milestones: [
            { id: 'ms-21', name: 'Kiểm tra tích hợp xương', status: 'in_progress' },
            { id: 'ms-22', name: 'Đặt nắp lành thương (Healing Abutment)', status: 'pending' },
          ],
        },
        {
          id: 'sj-03',
          name: 'Lắp mão răng sứ phục hình',
          status: 'pending',
          milestones: [
            { id: 'ms-31', name: 'Lấy dấu răng & Chế tác răng sứ', status: 'pending' },
            { id: 'ms-32', name: 'Thử răng sứ & Lắp cố định', status: 'pending' },
          ],
        },
      ],
    },
    {
      id: 'journey-02',
      patientName: 'Lê Thị Mai',
      type: 'Chỉnh nha mặt trong (Orthodontics)',
      status: 'active',
      startedAt: '2026-07-15',
      subJourneys: [
        {
          id: 'sj-21',
          name: 'Giai đoạn chuẩn bị lâm sàng',
          status: 'completed',
          milestones: [
            { id: 'ms-41', name: 'Lấy mẫu răng & Phân tích khớp cắn', status: 'completed' },
            { id: 'ms-42', name: 'Nhổ răng tiền cối chỉ định', status: 'completed' },
          ],
        },
        {
          id: 'sj-22',
          name: 'Gắn khí cụ chỉnh nha',
          status: 'active',
          milestones: [
            { id: 'ms-51', name: 'Gắn mắc cài hai hàm', status: 'in_progress' },
          ],
        },
      ],
    },
  ]);

  const handleStartJourney = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) {
      toast.error('Vui lòng nhập tên bệnh nhân');
      return;
    }

    const newJourney: CareJourney = {
      id: `journey-${Date.now()}`,
      patientName,
      type: journeyType === 'implant_care' ? 'Cấy ghép Implant răng hàm' : 'Chỉnh nha niềng răng',
      status: 'active',
      startedAt: new Date().toISOString().split('T')[0],
      subJourneys: [
        {
          id: `sj-${Date.now()}`,
          name: 'Khám lâm sàng ban đầu',
          status: 'active',
          milestones: [
            { id: `ms-${Date.now()}-1`, name: 'Chụp phim & Lên phác đồ', status: 'in_progress' },
            { id: `ms-${Date.now()}-2`, name: 'Xét nghiệm máu kiểm tra', status: 'pending' },
          ],
        },
      ],
    };

    setJourneys((prev) => [newJourney, ...prev]);
    setSelectedJourneyId(newJourney.id);
    toast.success('🚀 Khởi chạy Care Journey điều trị mới thành công');
    
    setPatientName('');
    setShowAddModal(false);
  };

  const handleUpdateMilestone = (journeyId: string, subId: string, milestoneId: string, newStatus: any) => {
    setJourneys((prev) =>
      prev.map((j) => {
        if (j.id === journeyId) {
          const updatedSjs = j.subJourneys.map((sj) => {
            if (sj.id === subId) {
              const updatedMs = sj.milestones.map((m) =>
                m.id === milestoneId ? { ...m, status: newStatus } : m
              );
              return { ...sj, milestones: updatedMs };
            }
            return sj;
          });
          return { ...j, subJourneys: updatedSjs };
        }
        return j;
      })
    );
    toast.info(`Cập nhật tiến trình: ${newStatus}`);
  };

  const selectedJourney = journeys.find((j) => j.id === selectedJourneyId) || journeys[0] || null;

  return (
    <div className="p-6 w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 border border-teal-500/20 shadow-sm">
            <Activity className="w-5 h-5" />
          </span>
          <div className="text-left">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Hành trình điều trị (Care Journeys)
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quản lý lộ trình điều trị, các giai đoạn và mốc lâm sàng của bệnh nhân dài hạn
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Khởi chạy Hành trình mới
        </button>
      </div>

      {/* Main 2-column workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Journeys List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm hành trình bệnh nhân..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
              />
            </div>

            <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-0.5 scrollbar-thin">
              {journeys
                .filter((j) => j.patientName.toLowerCase().includes(searchQuery.toLowerCase()) || j.type.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((j) => {
                  const isSelected = j.id === selectedJourneyId;
                  return (
                    <div
                      key={j.id}
                      onClick={() => setSelectedJourneyId(j.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all text-left group ${
                        isSelected
                          ? 'bg-teal-50/40 border-teal-500 dark:bg-teal-950/20'
                          : 'bg-white border-slate-150 hover:border-slate-300 dark:bg-slate-950 dark:border-slate-800/80'
                      }`}
                    >
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-teal-600 transition-colors">
                        {j.patientName}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-normal font-semibold">
                        Lộ trình: {j.type}
                      </p>
                      <div className="flex items-center justify-between mt-3 text-[9px] text-slate-400 font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Bắt đầu: {j.startedAt}
                        </span>
                        <span className="px-1.5 py-0.5 bg-teal-50 text-teal-600 dark:bg-teal-950/30 rounded font-bold uppercase scale-90">
                          {j.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Right column: Selected Journey Detail (Visual Roadmap Timeline) */}
        <div className="lg:col-span-2">
          {selectedJourney ? (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shadow-sm space-y-6 text-left">
              {/* Profile card */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Hành trình y khoa</span>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{selectedJourney.type}</h3>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-teal-600" /> Bệnh nhân: <b>{selectedJourney.patientName}</b></span>
                    <span>•</span>
                    <span>Bắt đầu từ: {selectedJourney.startedAt}</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-lg uppercase tracking-wider shadow-sm">
                  {selectedJourney.status}
                </span>
              </div>

              {/* Sub-journeys Accordion/Timeline list */}
              <div className="space-y-5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tiến độ chi tiết từng giai đoạn:</h4>
                
                <div className="space-y-4">
                  {selectedJourney.subJourneys.map((sj, idx) => (
                    <div key={sj.id} className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-800 last:border-l-0 pb-2">
                      {/* Timeline dot */}
                      <span className={`absolute -left-[7px] top-1.5 w-3 h-3 rounded-full border-2 ${
                        sj.status === 'completed' ? 'bg-emerald-500 border-emerald-500 shadow' : sj.status === 'active' ? 'bg-teal-500 border-teal-500 animate-pulse shadow-sm' : 'bg-slate-200 border-slate-200'
                      }`} />

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200">{sj.name}</h5>
                          <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded uppercase ${
                            sj.status === 'completed' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' : sj.status === 'active' ? 'bg-teal-50 text-teal-600 dark:bg-teal-950/20' : 'bg-slate-100 text-slate-500 dark:bg-slate-900'
                          }`}>
                            {sj.status}
                          </span>
                        </div>

                        {/* Milestones list */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                          {sj.milestones.map((m) => (
                            <div key={m.id} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30">
                              <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">{m.name}</span>
                              <div className="flex items-center gap-1">
                                {m.status === 'completed' ? (
                                  <span className="p-0.5 rounded-full bg-emerald-500 text-white"><Check className="w-2.5 h-2.5" /></span>
                                ) : m.status === 'in_progress' ? (
                                  <button 
                                    onClick={() => handleUpdateMilestone(selectedJourney.id, sj.id, m.id, 'completed')}
                                    className="px-1.5 py-0.5 bg-teal-600 text-white text-[9px] font-bold rounded hover:bg-teal-700 transition-colors"
                                  >
                                    Đánh dấu xong
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => handleUpdateMilestone(selectedJourney.id, sj.id, m.id, 'in_progress')}
                                    className="p-1 border border-slate-300 hover:border-slate-400 text-slate-500 rounded"
                                  >
                                    <Play className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
              Chọn hành trình bên trái để xem chi tiết tiến độ điều trị
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-left animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-teal-600" />
              Khởi chạy Hành trình điều trị mới
            </h3>

            <form onSubmit={handleStartJourney} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">Tên bệnh nhân *</label>
                <input
                  type="text"
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Nhập tên bệnh nhân khám..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">Loại lộ trình điều trị y khoa</label>
                <select
                  value={journeyType}
                  onChange={(e) => setJourneyType(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                >
                  <option value="implant_care">Cấy ghép Implant răng (#36/Nobel)</option>
                  <option value="orthodontics">Chỉnh nha niềng răng mặt trong</option>
                  <option value="general_dental">Điều trị tổng quát nha khoa</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 font-bold rounded-xl transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-all"
                >
                  Bắt đầu Lộ trình
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
