'use client';

import React, { useState, useEffect } from 'react';
import { NursingVitalSigns, InpatientAdmission, Bed, Ward } from '@/types/healthcare';
import { useNursingEngine } from '@/hooks/use-nursing-engine';
import { InpatientAdmissionService, BedEngineService } from '@/services/healthcare-hospital-services';
import {
  Activity,
  Heart,
  Thermometer,
  Wind,
  Droplets,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Plus,
  User,
  Clock,
  Stethoscope,
  FileText,
} from 'lucide-react';

export default function NursingVitalsPage() {
  // Use Nursing Engine hook
  const { recordVitals, getVitals, loading: engineLoading, error: engineError } = useNursingEngine();
  
  const [admissions, setAdmissions] = useState<InpatientAdmission[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string>('');
  const [vitals, setVitals] = useState<NursingVitalSigns[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Add Vitals Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [temperature, setTemperature] = useState<string>('37.0');
  const [heartRate, setHeartRate] = useState<string>('75');
  const [systolicBp, setSystolicBp] = useState<string>('120');
  const [diastolicBp, setDiastolicBp] = useState<string>('80');
  const [spo2, setSpo2] = useState<string>('98');
  const [respiratoryRate, setRespiratoryRate] = useState<string>('16');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedAdmissionId) {
      loadVitals(selectedAdmissionId);
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

  const loadVitals = async (admissionId: string) => {
    try {
      // Use getVitals from useNursingEngine hook
      const result = await getVitals({
        tenantId: 'bella_healthcare',
        encounterId: admissionId, // Using admissionId as encounterId for now
      });
      
      if (result.success && result.data) {
        setVitals(result.data);
      }
    } catch (error) {
      console.error('[NursingVitals] Error loading vitals:', error);
    }
  };

  const handleRecordVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmissionId) return;

    const admission = admissions.find((a) => a.id === selectedAdmissionId);
    if (!admission) return;

    try {
      // Use recordVitals from useNursingEngine hook
      const result = await recordVitals({
        tenantId: 'bella_healthcare',
        encounterId: admission.encounter_id,
        patientId: admission.patient_id,
        practitionerId: 'nurse-001',
        temperature: parseFloat(temperature),
        heartRate: parseInt(heartRate, 10),
        bloodPressureSystolic: parseInt(systolicBp, 10),
        bloodPressureDiastolic: parseInt(diastolicBp, 10),
        oxygenSaturation: parseInt(spo2, 10),
        respiratoryRate: respiratoryRate ? parseInt(respiratoryRate, 10) : undefined,
        notes: notes || undefined,
      });

      if (result.success && result.data) {
        setVitals((prev) => [result.data, ...prev]);
        setShowAddModal(false);
        resetForm();
      } else {
        alert(`Không thể ghi nhận sinh hiệu: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert('Không thể ghi nhận sinh hiệu');
      console.error('[NursingVitals] Error recording vitals:', error);
    }
  };

  const resetForm = () => {
    setTemperature('37.0');
    setHeartRate('75');
    setSystolicBp('120');
    setDiastolicBp('80');
    setSpo2('98');
    setRespiratoryRate('16');
    setNotes('');
  };

  const getVitalStatus = (vital: NursingVitalSigns) => {
    const alerts: string[] = [];

    if (vital.temperature < 36.0 || vital.temperature > 37.5) {
      alerts.push('Nhiệt độ bất thường');
    }
    if (vital.heart_rate < 60 || vital.heart_rate > 100) {
      alerts.push('Nhịp tim bất thường');
    }
    if (vital.systolic_bp < 90 || vital.systolic_bp > 140 || vital.diastolic_bp < 60 || vital.diastolic_bp > 90) {
      alerts.push('Huyết áp bất thường');
    }
    if (vital.spo2 < 95) {
      alerts.push('SpO2 thấp');
    }

    return alerts.length > 0 ? { hasAlert: true, messages: alerts } : { hasAlert: false, messages: [] };
  };

  const selectedAdmission = admissions.find((a) => a.id === selectedAdmissionId);
  const selectedBed = selectedAdmission ? beds.find((b) => b.id === selectedAdmission.bed_id) : null;
  const selectedWard = selectedAdmission ? wards.find((w) => w.id === selectedAdmission.ward_id) : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-cyan-900 via-blue-900 to-indigo-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2 text-cyan-300 mb-1">
            <Activity className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Bella Hospital Nursing • Vital Signs Monitoring System
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">Theo Dõi Sinh Hiệu Điều Dưỡng</h1>
          <p className="text-cyan-100 text-sm mt-1">
            Ghi nhận và giám sát sinh hiệu bệnh nhân nội trú: nhiệt độ, huyết áp, nhịp tim, SpO2, nhịp thở.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          disabled={!selectedAdmissionId}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-500 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg transition-all border border-emerald-400/30"
        >
          <Plus className="w-5 h-5" />
          <span>Ghi Nhận Sinh Hiệu Mới</span>
        </button>
      </div>

      {/* Patient Selection & Current Info */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-700 mb-2">Chọn Bệnh Nhân Nội Trú:</label>
            <select
              value={selectedAdmissionId}
              onChange={(e) => setSelectedAdmissionId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
                <div className="text-sm font-bold text-cyan-700">{selectedBed?.bed_code}</div>
              </div>
              <div className="text-center px-3 border-r border-slate-300">
                <div className="text-xs text-slate-500 font-medium">Khoa</div>
                <div className="text-sm font-bold text-slate-800">{selectedWard?.name}</div>
              </div>
              <div className="text-center px-3">
                <div className="text-xs text-slate-500 font-medium">Mã BN</div>
                <div className="text-sm font-bold text-indigo-700">{selectedAdmission.patient_id}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Vitals Timeline */}
      {loading ? (
        <div className="p-12 text-center text-slate-500">Đang tải dữ liệu sinh hiệu...</div>
      ) : !selectedAdmissionId ? (
        <div className="p-12 text-center text-slate-400">
          Vui lòng chọn bệnh nhân để xem sinh hiệu
        </div>
      ) : vitals.length === 0 ? (
        <div className="p-12 text-center text-slate-400">
          Chưa có dữ liệu sinh hiệu. Nhấn "Ghi Nhận Sinh Hiệu Mới" để bắt đầu.
        </div>
      ) : (
        <div className="space-y-4">
          {vitals.map((vital) => {
            const status = getVitalStatus(vital);
            return (
              <div
                key={vital.id}
                className={`bg-white p-5 rounded-2xl border shadow-sm transition-all hover:shadow-md ${
                  status.hasAlert ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200'
                }`}
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-cyan-100 rounded-lg text-cyan-700">
                      <Stethoscope className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">
                        Ghi nhận lúc: {new Date(vital.recorded_at).toLocaleString('vi-VN')}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center space-x-1 mt-0.5">
                        <User className="w-3 h-3" />
                        <span>Điều dưỡng ID: {vital.nurse_practitioner_id}</span>
                      </div>
                    </div>
                  </div>
                  {status.hasAlert ? (
                    <div className="flex items-center space-x-2 text-rose-700 bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-200">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-xs font-bold">Có chỉ số bất thường</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs font-bold">Bình thường</span>
                    </div>
                  )}
                </div>

                {/* Vitals Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {/* Temperature */}
                  <div className="p-3 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-200">
                    <div className="flex items-center justify-between mb-1">
                      <Thermometer className="w-4 h-4 text-orange-600" />
                      <span className="text-[10px] font-bold text-orange-700 uppercase">Nhiệt độ</span>
                    </div>
                    <div className="text-2xl font-bold text-orange-900">{vital.temperature}°C</div>
                    <div className="text-[10px] text-orange-600 mt-0.5">Bình thường: 36.0-37.5</div>
                  </div>

                  {/* Heart Rate */}
                  <div className="p-3 bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl border border-rose-200">
                    <div className="flex items-center justify-between mb-1">
                      <Heart className="w-4 h-4 text-rose-600" />
                      <span className="text-[10px] font-bold text-rose-700 uppercase">Nhịp tim</span>
                    </div>
                    <div className="text-2xl font-bold text-rose-900">{vital.heart_rate}</div>
                    <div className="text-[10px] text-rose-600 mt-0.5">bpm (60-100)</div>
                  </div>

                  {/* Blood Pressure */}
                  <div className="p-3 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-200">
                    <div className="flex items-center justify-between mb-1">
                      <Activity className="w-4 h-4 text-indigo-600" />
                      <span className="text-[10px] font-bold text-indigo-700 uppercase">Huyết áp</span>
                    </div>
                    <div className="text-2xl font-bold text-indigo-900">
                      {vital.systolic_bp}/{vital.diastolic_bp}
                    </div>
                    <div className="text-[10px] text-indigo-600 mt-0.5">mmHg (90-140/60-90)</div>
                  </div>

                  {/* SpO2 */}
                  <div className="p-3 bg-gradient-to-br from-cyan-50 to-teal-50 rounded-xl border border-cyan-200">
                    <div className="flex items-center justify-between mb-1">
                      <Droplets className="w-4 h-4 text-cyan-600" />
                      <span className="text-[10px] font-bold text-cyan-700 uppercase">SpO2</span>
                    </div>
                    <div className="text-2xl font-bold text-cyan-900">{vital.spo2}%</div>
                    <div className="text-[10px] text-cyan-600 mt-0.5">Oxy máu (≥95%)</div>
                  </div>

                  {/* Respiratory Rate */}
                  {vital.respiratory_rate && (
                    <div className="p-3 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-200">
                      <div className="flex items-center justify-between mb-1">
                        <Wind className="w-4 h-4 text-emerald-600" />
                        <span className="text-[10px] font-bold text-emerald-700 uppercase">Nhịp thở</span>
                      </div>
                      <div className="text-2xl font-bold text-emerald-900">{vital.respiratory_rate}</div>
                      <div className="text-[10px] text-emerald-600 mt-0.5">/phút (12-20)</div>
                    </div>
                  )}

                  {/* Status Summary */}
                  <div className="p-3 bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <FileText className="w-4 h-4 text-slate-600" />
                      <span className="text-[10px] font-bold text-slate-700 uppercase">Trạng thái</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      {status.hasAlert ? '⚠️ Bất thường' : '✅ Ổn định'}
                    </div>
                  </div>
                </div>

                {/* Alerts */}
                {status.hasAlert && (
                  <div className="mt-4 p-3 bg-rose-100 border border-rose-200 rounded-xl">
                    <div className="font-bold text-xs text-rose-800 mb-1">⚠️ CẢNH BÁO:</div>
                    <ul className="text-xs text-rose-700 space-y-0.5 list-disc list-inside">
                      {status.messages.map((msg, idx) => (
                        <li key={idx}>{msg}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Notes */}
                {vital.notes && (
                  <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="font-bold text-xs text-slate-700 mb-1">Ghi chú của điều dưỡng:</div>
                    <p className="text-xs text-slate-600">{vital.notes}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Vitals Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-cyan-200">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center space-x-2">
              <Activity className="w-6 h-6 text-cyan-600" />
              <span>Ghi Nhận Sinh Hiệu Bệnh Nhân</span>
            </h2>

            <form onSubmit={handleRecordVitals} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Temperature */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1">
                    <Thermometer className="w-3.5 h-3.5 text-orange-600" />
                    <span>Nhiệt độ (°C):</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    placeholder="37.0"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                  <div className="text-[10px] text-slate-500 mt-0.5">Bình thường: 36.0 - 37.5°C</div>
                </div>

                {/* Heart Rate */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1">
                    <Heart className="w-3.5 h-3.5 text-rose-600" />
                    <span>Nhịp tim (bpm):</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={heartRate}
                    onChange={(e) => setHeartRate(e.target.value)}
                    placeholder="75"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                  <div className="text-[10px] text-slate-500 mt-0.5">Bình thường: 60 - 100 bpm</div>
                </div>

                {/* Systolic BP */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Huyết áp tâm thu (mmHg):</label>
                  <input
                    type="number"
                    required
                    value={systolicBp}
                    onChange={(e) => setSystolicBp(e.target.value)}
                    placeholder="120"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                  <div className="text-[10px] text-slate-500 mt-0.5">Bình thường: 90 - 140 mmHg</div>
                </div>

                {/* Diastolic BP */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Huyết áp tâm trương (mmHg):</label>
                  <input
                    type="number"
                    required
                    value={diastolicBp}
                    onChange={(e) => setDiastolicBp(e.target.value)}
                    placeholder="80"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                  <div className="text-[10px] text-slate-500 mt-0.5">Bình thường: 60 - 90 mmHg</div>
                </div>

                {/* SpO2 */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1">
                    <Droplets className="w-3.5 h-3.5 text-cyan-600" />
                    <span>SpO2 (%):</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value)}
                    placeholder="98"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                  <div className="text-[10px] text-slate-500 mt-0.5">Bình thường: ≥ 95%</div>
                </div>

                {/* Respiratory Rate */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1">
                    <Wind className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Nhịp thở (/phút):</span>
                  </label>
                  <input
                    type="number"
                    value={respiratoryRate}
                    onChange={(e) => setRespiratoryRate(e.target.value)}
                    placeholder="16"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                  <div className="text-[10px] text-slate-500 mt-0.5">Bình thường: 12 - 20 /phút</div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú (tùy chọn):</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ghi chú về tình trạng bệnh nhân, triệu chứng đặc biệt..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 shadow-md"
                >
                  Xác Nhận Ghi Nhận
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
