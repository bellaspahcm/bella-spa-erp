'use client';

import React, { useState, useEffect } from 'react';
import { MedicationAdministrationRecord, InpatientAdmission, Bed, Ward, MARStatus } from '@/types/healthcare';
import { MARService, InpatientAdmissionService, BedEngineService } from '@/services/healthcare-hospital-services';
import {
  Tablets,
  Clock,
  CheckCircle2,
  XCircle,
  PauseCircle,
  AlertCircle,
  Plus,
  User,
  Calendar,
  FileText,
  Syringe,
  ClipboardCheck,
} from 'lucide-react';

export default function MARPage() {
  const [admissions, setAdmissions] = useState<InpatientAdmission[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string>('');
  const [marRecords, setMarRecords] = useState<MedicationAdministrationRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Add MAR Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [drugName, setDrugName] = useState<string>('');
  const [dosage, setDosage] = useState<string>('');
  const [route, setRoute] = useState<string>('Uống sau ăn');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [scheduledTime, setScheduledTime] = useState<string>('');

  // Administer Modal State
  const [showAdministerModal, setShowAdministerModal] = useState<boolean>(false);
  const [selectedMAR, setSelectedMAR] = useState<MedicationAdministrationRecord | null>(null);
  const [administerNotes, setAdministerNotes] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedAdmissionId) {
      loadMAR(selectedAdmissionId);
    }
  }, [selectedAdmissionId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const admData = await InpatientAdmissionService.getInpatientAdmissions('bella_healthcare');
      const bedsData = await BedEngineService.getHospitalBeds('bella_healthcare');
      const wardsData = await BedEngineService.getHospitalWards('bella_healthcare');

      const activeAdmissions = admData.filter((a) => a.status === 'admitted');
      setAdmissions(activeAdmissions);
      setBeds(bedsData);
      setWards(wardsData);

      if (activeAdmissions.length > 0) {
        setSelectedAdmissionId(activeAdmissions[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMAR = async (admissionId: string) => {
    try {
      const marData = await MARService.getMARByAdmission(admissionId);
      setMarRecords(marData);
    } catch (error) {
      console.error('Error loading MAR:', error);
    }
  };

  const handleAddMAR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmissionId) return;

    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();

    try {
      const newMAR = await MARService.createMAR({
        tenantId: 'bella_healthcare',
        inpatientAdmissionId: selectedAdmissionId,
        prescriptionItemId: `rx-item-${Date.now()}`,
        drugName,
        dosage,
        route,
        scheduledTime: scheduledDateTime,
      });

      setMarRecords((prev) => [...prev, newMAR]);
      setShowAddModal(false);
      resetAddForm();
    } catch (error) {
      alert('Không thể tạo lệnh thuốc');
      console.error('Error creating MAR:', error);
    }
  };

  const handleAdministerMAR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMAR) return;

    try {
      const administered = await MARService.administerMAR({
        marId: selectedMAR.id,
        administeredByNurseId: 'nurse-001',
        notes: administerNotes || undefined,
      });

      setMarRecords((prev) => prev.map((m) => (m.id === administered.id ? administered : m)));
      setShowAdministerModal(false);
      setSelectedMAR(null);
      setAdministerNotes('');
    } catch (error) {
      alert('Không thể xác nhận thực hiện thuốc');
      console.error('Error administering MAR:', error);
    }
  };

  const resetAddForm = () => {
    setDrugName('');
    setDosage('');
    setRoute('Uống sau ăn');
    setScheduledDate('');
    setScheduledTime('');
  };

  const getStatusBadge = (status: MARStatus) => {
    switch (status) {
      case 'scheduled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            <Clock className="w-3 h-3 mr-1" />
            Đã lên lịch
          </span>
        );
      case 'administered':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Đã thực hiện
          </span>
        );
      case 'refused':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3 h-3 mr-1" />
            Bệnh nhân từ chối
          </span>
        );
      case 'held':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <PauseCircle className="w-3 h-3 mr-1" />
            Tạm ngưng
          </span>
        );
      case 'missed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300">
            <AlertCircle className="w-3 h-3 mr-1" />
            Bỏ lỡ
          </span>
        );
      default:
        return null;
    }
  };

  const isOverdue = (scheduledTime: string, status: MARStatus) => {
    if (status !== 'scheduled') return false;
    return new Date(scheduledTime) < new Date();
  };

  const groupedMAR = marRecords.reduce((acc, mar) => {
    const date = new Date(mar.scheduled_time).toLocaleDateString('vi-VN');
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(mar);
    return acc;
  }, {} as Record<string, MedicationAdministrationRecord[]>);

  const selectedAdmission = admissions.find((a) => a.id === selectedAdmissionId);
  const selectedBed = selectedAdmission ? beds.find((b) => b.id === selectedAdmission.bed_id) : null;
  const selectedWard = selectedAdmission ? wards.find((w) => w.id === selectedAdmission.ward_id) : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-blue-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2 text-indigo-300 mb-1">
            <ClipboardCheck className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Bella Hospital Nursing • MAR Management System
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">Phiếu Thực Hiện Y Lệnh Thuốc (MAR)</h1>
          <p className="text-indigo-100 text-sm mt-1">
            Medication Administration Record - Quản lý lịch uống thuốc và theo dõi việc thực hiện y lệnh của điều dưỡng.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          disabled={!selectedAdmissionId}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-500 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg transition-all border border-emerald-400/30"
        >
          <Plus className="w-5 h-5" />
          <span>Thêm Y Lệnh Thuốc</span>
        </button>
      </div>

      {/* Patient Selection */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-700 mb-2">Chọn Bệnh Nhân Nội Trú:</label>
            <select
              value={selectedAdmissionId}
              onChange={(e) => setSelectedAdmissionId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {admissions.length === 0 ? (
                <option value="">Không có bệnh nhân nào đang nằm viện</option>
              ) : (
                admissions.map((adm) => {
                  const bed = beds.find((b) => b.id === adm.bed_id);
                  const ward = wards.find((w) => w.id === adm.ward_id);
                  return (
                    <option key={adm.id} value={adm.id}>
                      {bed?.bed_code || 'N/A'} - {ward?.name || 'N/A'} - Mã BN: {adm.patient_id}
                    </option>
                  );
                })
              )}
            </select>
          </div>

          {selectedAdmission && (
            <div className="flex items-center space-x-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-center px-3 border-r border-slate-300">
                <div className="text-xs text-slate-500 font-medium">Giường</div>
                <div className="text-sm font-bold text-indigo-700">{selectedBed?.bed_code}</div>
              </div>
              <div className="text-center px-3 border-r border-slate-300">
                <div className="text-xs text-slate-500 font-medium">Khoa</div>
                <div className="text-sm font-bold text-slate-800">{selectedWard?.name}</div>
              </div>
              <div className="text-center px-3">
                <div className="text-xs text-slate-500 font-medium">Mã BN</div>
                <div className="text-sm font-bold text-purple-700">{selectedAdmission.patient_id}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MAR Stats */}
      {selectedAdmissionId && marRecords.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-2xl font-bold text-slate-800">
              {marRecords.filter((m) => m.status === 'scheduled').length}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">Đã lên lịch</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm">
            <div className="text-2xl font-bold text-emerald-700">
              {marRecords.filter((m) => m.status === 'administered').length}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">Đã thực hiện</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm">
            <div className="text-2xl font-bold text-rose-700">
              {marRecords.filter((m) => m.status === 'refused').length}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">Từ chối</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
            <div className="text-2xl font-bold text-amber-700">
              {marRecords.filter((m) => m.status === 'held').length}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">Tạm ngưng</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-2xl font-bold text-slate-700">
              {marRecords.filter((m) => isOverdue(m.scheduled_time, m.status)).length}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">Quá hạn</div>
          </div>
        </div>
      )}

      {/* MAR Timeline by Date */}
      {loading ? (
        <div className="p-12 text-center text-slate-500">Đang tải phiếu MAR...</div>
      ) : !selectedAdmissionId ? (
        <div className="p-12 text-center text-slate-400">Vui lòng chọn bệnh nhân để xem phiếu MAR</div>
      ) : marRecords.length === 0 ? (
        <div className="p-12 text-center text-slate-400">
          Chưa có y lệnh thuốc nào. Nhấn "Thêm Y Lệnh Thuốc" để bắt đầu.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedMAR)
            .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
            .map(([date, records]) => (
              <div key={date} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                {/* Date Header */}
                <div className="flex items-center space-x-2 mb-4 pb-3 border-b border-slate-100">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-800">{date}</h3>
                  <span className="text-xs text-slate-500">({records.length} y lệnh)</span>
                </div>

                {/* MAR Records */}
                <div className="space-y-3">
                  {records
                    .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())
                    .map((mar) => {
                      const overdue = isOverdue(mar.scheduled_time, mar.status);
                      return (
                        <div
                          key={mar.id}
                          className={`p-4 rounded-xl border transition-all ${
                            overdue
                              ? 'border-rose-200 bg-rose-50/50'
                              : mar.status === 'administered'
                              ? 'border-emerald-200 bg-emerald-50/30'
                              : 'border-slate-200 bg-slate-50/50'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            {/* Drug Info */}
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <Pill className="w-4 h-4 text-indigo-600" />
                                <span className="font-bold text-slate-800">{mar.drug_name}</span>
                                {overdue && (
                                  <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                                    ⚠️ QUÁ HẠN
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-600 space-y-1 ml-6">
                                <div className="flex items-center space-x-2">
                                  <Syringe className="w-3 h-3 text-slate-400" />
                                  <span>
                                    <strong>Liều dùng:</strong> {mar.dosage}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <FileText className="w-3 h-3 text-slate-400" />
                                  <span>
                                    <strong>Đường dùng:</strong> {mar.route}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>
                                    <strong>Giờ lên lịch:</strong>{' '}
                                    {new Date(mar.scheduled_time).toLocaleTimeString('vi-VN', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                                {mar.administered_time && (
                                  <div className="flex items-center space-x-2">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span className="text-emerald-700">
                                      <strong>Đã thực hiện lúc:</strong>{' '}
                                      {new Date(mar.administered_time).toLocaleTimeString('vi-VN', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </div>
                                )}
                                {mar.administered_by_nurse_id && (
                                  <div className="flex items-center space-x-2">
                                    <User className="w-3 h-3 text-slate-400" />
                                    <span>
                                      <strong>Điều dưỡng:</strong> {mar.administered_by_nurse_id}
                                    </span>
                                  </div>
                                )}
                                {mar.notes && (
                                  <div className="mt-2 p-2 bg-white border border-slate-200 rounded-lg">
                                    <strong className="text-slate-700">Ghi chú:</strong> {mar.notes}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Status & Actions */}
                            <div className="flex flex-col items-end space-y-2">
                              {getStatusBadge(mar.status)}
                              {mar.status === 'scheduled' && (
                                <button
                                  onClick={() => {
                                    setSelectedMAR(mar);
                                    setShowAdministerModal(true);
                                  }}
                                  className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  ✓ Xác nhận thực hiện
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Add MAR Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-indigo-200">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center space-x-2">
              <Pill className="w-6 h-6 text-indigo-600" />
              <span>Thêm Y Lệnh Thuốc Mới</span>
            </h2>

            <form onSubmit={handleAddMAR} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên thuốc:</label>
                <input
                  type="text"
                  required
                  value={drugName}
                  onChange={(e) => setDrugName(e.target.value)}
                  placeholder="Ví dụ: Amoxicillin 500mg"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Liều dùng:</label>
                  <input
                    type="text"
                    required
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    placeholder="Ví dụ: 1 viên"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Đường dùng:</label>
                  <select
                    value={route}
                    onChange={(e) => setRoute(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Uống sau ăn">Uống sau ăn</option>
                    <option value="Uống trước ăn">Uống trước ăn</option>
                    <option value="Tiêm tĩnh mạch">Tiêm tĩnh mạch</option>
                    <option value="Tiêm bắp">Tiêm bắp</option>
                    <option value="Truyền tĩnh mạch">Truyền tĩnh mạch</option>
                    <option value="Bôi ngoài da">Bôi ngoài da</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ngày:</label>
                  <input
                    type="date"
                    required
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Giờ:</label>
                  <input
                    type="time"
                    required
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    resetAddForm();
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-md"
                >
                  Thêm Y Lệnh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Administer MAR Modal */}
      {showAdministerModal && selectedMAR && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-emerald-200">
            <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center space-x-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <span>Xác Nhận Thực Hiện Y Lệnh</span>
            </h2>
            <p className="text-xs text-slate-600 mb-4">
              Xác nhận bạn đã thực hiện y lệnh thuốc <strong>{selectedMAR.drug_name}</strong> cho bệnh nhân.
            </p>

            <form onSubmit={handleAdministerMAR} className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                <div className="space-y-2">
                  <div>
                    <strong>Thuốc:</strong> {selectedMAR.drug_name}
                  </div>
                  <div>
                    <strong>Liều dùng:</strong> {selectedMAR.dosage}
                  </div>
                  <div>
                    <strong>Đường dùng:</strong> {selectedMAR.route}
                  </div>
                  <div>
                    <strong>Giờ lên lịch:</strong>{' '}
                    {new Date(selectedMAR.scheduled_time).toLocaleString('vi-VN')}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú (tùy chọn):</label>
                <textarea
                  rows={3}
                  value={administerNotes}
                  onChange={(e) => setAdministerNotes(e.target.value)}
                  placeholder="Ghi chú về phản ứng của bệnh nhân, tình trạng sau uống thuốc..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdministerModal(false);
                    setSelectedMAR(null);
                    setAdministerNotes('');
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-md"
                >
                  ✓ Xác Nhận Đã Thực Hiện
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
