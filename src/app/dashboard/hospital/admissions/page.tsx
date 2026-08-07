'use client';

import React, { useState, useEffect } from 'react';
import { InpatientAdmission, Bed, Ward } from '@/types/healthcare';
import { InpatientAdmissionService, BedEngineService } from '@/services/healthcare-hospital-services';
import {
  Hospital,
  UserPlus,
  Activity,
  FileCheck,
  CheckCircle2,
  Clock,
  User,
  Bed as BedIcon,
  Stethoscope,
  Pill,
  Printer,
} from 'lucide-react';

export default function HospitalAdmissionsPage() {
  const [admissions, setAdmissions] = useState<InpatientAdmission[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // New Admission Form State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [patientId, setPatientId] = useState<string>('pat-003');
  const [encounterId, setEncounterId] = useState<string>('enc-003');
  const [selectedWardId, setSelectedWardId] = useState<string>('ward-002');
  const [selectedBedId, setSelectedBedId] = useState<string>('');
  const [doctorName, setDoctorName] = useState<string font-semibold>('BS. Nguyễn Thị Mai');
  const [icd10Code, setIcd10Code] = useState<string>('J18.9');
  const [icd10Name, setIcd10Name] = useState<string>('Viêm phổi, không đặc hiệu');

  // Discharge State
  const [selectedDischargeAdmission, setSelectedDischargeAdmission] = useState<InpatientAdmission | null>(null);
  const [dischargeSummary, setDischargeSummary] = useState<string>('');

  const handlePrintDocument = (type: 'admission' | 'prescription' | 'mar' | 'discharge', adm: InpatientAdmission) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let content = '';
    const bed = beds.find((b) => b.id === adm.bed_id);
    const ward = wards.find((w) => w.id === adm.ward_id);

    if (type === 'admission') {
      content = `
        <div style="font-family: Arial, sans-serif; padding: 40px; line-height: 1.6;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h2>BỆNH VIỆN ĐA KHOA QUỐC TẾ BELLA</h2>
            <p>Mã HS: \${adm.patient_id} | Đợt nhập viện: \${adm.id}</p>
            <hr style="border: 1px solid #ccc; width: 60%;" />
            <h1 style="margin-top: 20px;">PHIẾU TIẾP NHẬN NỘI TRÚ</h1>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <tr>
              <td style="padding: 8px; width: 30%;"><strong>Họ và tên bệnh nhân:</strong></td>
              <td style="padding: 8px; border-bottom: 1px dashed #000;">Nguyễn Văn A</td>
              <td style="padding: 8px; width: 15%;"><strong>Giới tính:</strong></td>
              <td style="padding: 8px; border-bottom: 1px dashed #000;">Nam</td>
            </tr>
            <tr>
              <td style="padding: 8px;"><strong>Mã phòng/giường:</strong></td>
              <td style="padding: 8px; border-bottom: 1px dashed #000;">\${bed?.bed_code || adm.bed_id} (\${ward?.name || 'Khoa Nội'})</td>
              <td style="padding: 8px;"><strong>Ngày nhập viện:</strong></td>
              <td style="padding: 8px; border-bottom: 1px dashed #000;">\${new Date(adm.admitted_at).toLocaleDateString('vi-VN')}</td>
            </tr>
            <tr>
              <td style="padding: 8px;"><strong>Chẩn đoán chính:</strong></td>
              <td colspan="3" style="padding: 8px; border-bottom: 1px dashed #000;">
                \${adm.admission_diagnosis.map((d) => `[\${d.icd10_code}] \${d.icd10_name_vi}`).join(', ')}
              </td>
            </tr>
          </table>
          <div style="margin-top: 50px; float: right; text-align: center; width: 250px;">
            <p>Ngày \${new Date().getDate()} tháng \${new Date().getMonth() + 1} năm \${new Date().getFullYear()}</p>
            <strong>BÁC SĨ ĐIỀU TRỊ</strong>
            <div style="margin-top: 80px;">BS. Nguyễn Thị Mai</div>
          </div>
        </div>
      `;
    } else if (type === 'prescription') {
      content = `
        <div style="font-family: Arial, sans-serif; padding: 40px; line-height: 1.6;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h2>BỆNH VIỆN ĐA KHOA QUỐC TẾ BELLA</h2>
            <p>Mã HS: \${adm.patient_id} | Đơn thuốc: RX-\${adm.id.slice(-6)}</p>
            <hr style="border: 1px solid #ccc; width: 60%;" />
            <h1 style="margin-top: 20px;">ĐƠN THUỐC ĐIỀU TRỊ NỘI TRÚ</h1>
          </div>
          <p><strong>Bệnh nhân:</strong> Nguyễn Văn A | <strong>Tuổi:</strong> 35</p>
          <p><strong>Chẩn đoán:</strong> \${adm.admission_diagnosis.map((d) => `[\${d.icd10_code}] \${d.icd10_name_vi}`).join(', ')}</p>
          <h3 style="margin-top: 30px; border-bottom: 2px solid #000; padding-bottom: 5px;">CHỈ ĐỊNH THUỐC</h3>
          <ol style="padding-left: 20px; font-size: 15px;">
            <li style="margin-bottom: 15px;">
              <strong>Amoxicillin 500mg</strong> - Số lượng: 20 Viên<br />
              <i>Liều dùng: Uống 2 viên/ngày, chia 2 lần sáng tối sau ăn.</i>
            </li>
            <li style="margin-bottom: 15px;">
              <strong>Paracetamol 500mg</strong> - Số lượng: 10 Viên<br />
              <i>Liều dùng: Uống 1 viên khi sốt > 38.5 độ C, cách tối thiểu 4-6 tiếng.</i>
            </li>
          </ol>
          <div style="margin-top: 60px; float: right; text-align: center; width: 250px;">
            <p>Ngày \${new Date().getDate()} tháng \${new Date().getMonth() + 1} năm \${new Date().getFullYear()}</p>
            <strong>BÁC SĨ KÊ ĐƠN</strong>
            <div style="margin-top: 80px;">BS. Nguyễn Thị Mai</div>
          </div>
        </div>
      `;
    } else if (type === 'mar') {
      content = `
        <div style="font-family: Arial, sans-serif; padding: 30px; line-height: 1.4;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2>BỆNH VIỆN ĐA KHOA QUỐC TẾ BELLA</h2>
            <h3>PHIẾU THEO DÕI SỬ DỤNG THUỐC (MAR CARD)</h3>
            <p>Giường: \${bed?.bed_code || adm.bed_id} | Khoa: \${ward?.name || 'Khoa Nội'} | Bệnh nhân: Nguyễn Văn A</p>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;" border="1">
            <thead>
              <tr style="background-color: #f2f2f2; font-size: 13px;">
                <th style="padding: 8px;">Tên Thuốc / Hàm Lượng</th>
                <th style="padding: 8px;">Sáng (08:00)</th>
                <th style="padding: 8px;">Trưa (12:00)</th>
                <th style="padding: 8px;">Chiều (16:00)</th>
                <th style="padding: 8px;">Tối (20:00)</th>
                <th style="padding: 8px;">Ký xác nhận (Điều dưỡng)</th>
              </tr>
            </thead>
            <tbody style="font-size: 12px;">
              <tr>
                <td style="padding: 10px;"><strong>Amoxicillin 500mg</strong></td>
                <td style="text-align: center;">1 Viên</td>
                <td style="text-align: center;">-</td>
                <td style="text-align: center;">-</td>
                <td style="text-align: center;">1 Viên</td>
                <td style="padding: 10px;">ĐD. Nguyễn Văn B</td>
              </tr>
              <tr>
                <td style="padding: 10px;"><strong>Glucose 5% (Truyền dịch)</strong></td>
                <td style="text-align: center;">500 ml</td>
                <td style="text-align: center;">-</td>
                <td style="text-align: center;">-</td>
                <td style="text-align: center;">-</td>
                <td style="padding: 10px;">ĐD. Nguyễn Văn B</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    } else if (type === 'discharge') {
      content = `
        <div style="font-family: Arial, sans-serif; padding: 40px; line-height: 1.6;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h2>BỆNH VIỆN ĐA KHOA QUỐC TẾ BELLA</h2>
            <p>Mã HS: \${adm.patient_id} | Đợt điều trị: \${adm.id}</p>
            <hr style="border: 1px solid #ccc; width: 60%;" />
            <h1 style="margin-top: 20px;">GIẤY RA VIỆN (DISCHARGE REPORT)</h1>
          </div>
          <p><strong>Bệnh nhân:</strong> Nguyễn Văn A | <strong>Giới tính:</strong> Nam | <strong>Tuổi:</strong> 35</p>
          <p><strong>Chẩn đoán ra viện:</strong> \${adm.admission_diagnosis.map((d) => `[\${d.icd10_code}] \${d.icd10_name_vi}`).join(', ')}</p>
          <p><strong>Tóm tắt quá trình điều trị:</strong> \${adm.discharge_summary || 'Bệnh nhân đáp ứng điều trị tốt, các chỉ số sinh hiệu trở lại bình thường.'}</p>
          <p><strong>Lời dặn bác sĩ:</strong> Uống thuốc theo đơn ra viện, tái khám sau 7 ngày.</p>
          <div style="margin-top: 60px; float: right; text-align: center; width: 250px;">
            <p>Ngày \${new Date().getDate()} tháng \${new Date().getMonth() + 1} năm \${new Date().getFullYear()}</p>
            <strong>TRƯỞNG KHOA LÂM SÀNG</strong>
            <div style="margin-top: 80px;">BS. Nguyễn Thị Mai</div>
          </div>
        </div>
      `;
    }

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const admData = await InpatientAdmissionService.getInpatientAdmissions('bella_healthcare');
      const bedsData = await BedEngineService.getHospitalBeds('bella_healthcare');
      const wardsData = await BedEngineService.getHospitalWards('bella_healthcare');
      setAdmissions(admData);
      setBeds(bedsData);
      setWards(wardsData);

      const availableBed = bedsData.find((b) => b.status === 'available');
      if (availableBed) {
        setSelectedBedId(availableBed.id);
      }
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBedId) {
      alert('Vui lòng chọn giường trống để gán bệnh nhân!');
      return;
    }

    try {
      const created = await InpatientAdmissionService.createInpatientAdmission({
        tenantId: 'bella_healthcare',
        encounterId: encounterId || `enc-${Date.now()}`,
        patientId: patientId || `pat-${Date.now()}`,
        bedId: selectedBedId,
        wardId: selectedWardId,
        admittingDoctorId: 'doc-001',
        attendingDoctorId: 'doc-001',
        admissionDiagnosis: [
          {
            icd10_code: icd10Code || 'I10',
            icd10_name_vi: icd10Name || 'Tăng huyết áp vô căn',
            is_primary: true,
          },
        ],
      });

      setAdmissions((prev) => [created, ...prev]);
      setShowAddModal(false);
      await loadData();
    } catch {
      alert('Tạo đợt nhập viện thất bại');
    }
  };

  const handleConfirmDischarge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDischargeAdmission) return;

    try {
      const discharged = await InpatientAdmissionService.dischargePatient(
        selectedDischargeAdmission.id,
        dischargeSummary || 'Bệnh nhân ổn định, đáp ứng điều trị nội trú tốt.'
      );

      setAdmissions((prev) => prev.map((a) => (a.id === discharged.id ? discharged : a)));
      setSelectedDischargeAdmission(null);
      setDischargeSummary('');
      await loadData();
    } catch {
      alert('Ra viện thất bại');
    }
  };

  const availableBeds = beds.filter((b) => b.status === 'available');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2 text-indigo-300 mb-1">
            <Hospital className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Bella Hospital Core • Inpatient EMR & MAR Engine</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">Quản Lý Bệnh Án Nội Trú & Y Lệnh Lương Y</h1>
          <p className="text-indigo-100 text-sm mt-1">
            Theo dõi danh sách bệnh nhân đang nằm viện, tiếp nhận nhập viện, thực hiện y lệnh MAR và làm thủ tục xuất viện.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-emerald-900/50 transition-all border border-emerald-400/30"
        >
          <UserPlus className="w-5 h-5" />
          <span>Tiếp Nhập Bệnh Nhân Nội Trú</span>
        </button>
      </div>

      {/* Admissions Table View */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
            <Stethoscope className="w-5 h-5 text-indigo-600" />
            <span>Danh Sách Đợt Điều Trị Nội Trú ({admissions.length})</span>
          </h2>
          <span className="text-xs text-slate-500 font-medium">Tự động đồng bộ với Bed Engine</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Đang tải hồ sơ bệnh án nội trú...</div>
        ) : admissions.length === 0 ? (
          <div className="p-12 text-center text-slate-400">Chưa có bệnh nhân nào nhập viện nội trú.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Mã Đợt / Bệnh Nhân</th>
                  <th className="py-3 px-4">Khoa & Giường Nằm</th>
                  <th className="py-3 px-4">Chẩn Đón Nhập Viện</th>
                  <th className="py-3 px-4">Thời Gian Nhập</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {admissions.map((adm) => {
                  const bed = beds.find((b) => b.id === adm.bed_id);
                  const ward = wards.find((w) => w.id === adm.ward_id);
                  return (
                    <tr key={adm.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="font-bold text-indigo-900">{adm.id}</div>
                        <div className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>Mã BN: {adm.patient_id}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{ward?.name || 'Khoa Nội'}</div>
                        <div className="text-[11px] text-emerald-700 font-bold flex items-center space-x-1 mt-0.5">
                          <BedIcon className="w-3 h-3 text-emerald-600" />
                          <span>Giường: {bed?.bed_code || adm.bed_id}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        {adm.admission_diagnosis.map((diag, i) => (
                          <div key={i} className="font-medium text-slate-800">
                            <span className="font-bold text-indigo-700">[{diag.icd10_code}]</span> {diag.icd10_name_vi}
                          </div>
                        ))}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {new Date(adm.admitted_at).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-3.5 px-4">
                        {adm.status === 'admitted' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            Đang Điều Trị
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                            Đã Xuất Viện
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1">
                        <button
                          onClick={() => handlePrintDocument('admission', adm)}
                          className="inline-flex items-center space-x-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 rounded-lg text-[10px] font-semibold"
                          title="In Phiếu Tiếp Nhập"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Phiếu Nhập</span>
                        </button>
                        <button
                          onClick={() => handlePrintDocument('prescription', adm)}
                          className="inline-flex items-center space-x-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 rounded-lg text-[10px] font-semibold"
                          title="In Đơn Thuốc"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Đơn Thuốc</span>
                        </button>
                        <button
                          onClick={() => handlePrintDocument('mar', adm)}
                          className="inline-flex items-center space-x-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 rounded-lg text-[10px] font-semibold"
                          title="In Phiếu MAR"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Phiếu MAR</span>
                        </button>
                        {adm.status === 'admitted' ? (
                          <button
                            onClick={() => setSelectedDischargeAdmission(adm)}
                            className="inline-flex items-center space-x-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-lg text-[10px] font-semibold"
                          >
                            <FileCheck className="w-3 h-3" />
                            <span>Ra Viện</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePrintDocument('discharge', adm)}
                            className="inline-flex items-center space-x-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg text-[10px] font-semibold"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Giấy Ra Viện</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Inpatient Admission Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center space-x-2">
              <UserPlus className="w-6 h-6 text-emerald-600" />
              <span>Tiếp Nhập Bệnh Nhân Điều Trị Nội Trú</span>
            </h2>

            <form onSubmit={handleCreateAdmission} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mã Bệnh Nhân (Patient ID):</label>
                  <input
                    type="text"
                    required
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mã Lượt Khám (Encounter ID):</label>
                  <input
                    type="text"
                    required
                    value={encounterId}
                    onChange={(e) => setEncounterId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chọn Khoa Điều Trị:</label>
                  <select
                    value={selectedWardId}
                    onChange={(e) => setSelectedWardId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-slate-50"
                  >
                    {wards.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chọn Giường Trống:</label>
                  <select
                    value={selectedBedId}
                    onChange={(e) => setSelectedBedId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-slate-50"
                  >
                    {availableBeds.length === 0 ? (
                      <option value="">Không có giường trống</option>
                    ) : (
                      availableBeds.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bed_code} ({b.bed_type.toUpperCase()})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mã Chẩn Đoán ICD-10:</label>
                  <input
                    type="text"
                    required
                    value={icd10Code}
                    onChange={(e) => setIcd10Code(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-bold text-indigo-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tên Chẩn Đoán Tiếng Việt:</label>
                  <input
                    type="text"
                    required
                    value={icd10Name}
                    onChange={(e) => setIcd10Name(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-md"
                >
                  Xác Nhận Nhập Viện
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Discharge Summary Modal */}
      {selectedDischargeAdmission && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-indigo-200">
            <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center space-x-2">
              <FileCheck className="w-6 h-6 text-indigo-600" />
              <span>Xác Nhận Thủ Tục Xuất Viện</span>
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Mã đợt nhập viện: <strong>{selectedDischargeAdmission.id}</strong>. Việc xuất viện sẽ giải phóng giường bệnh và cập nhật trạng thái giường về vệ sinh khử khuẩn.
            </p>

            <form onSubmit={handleConfirmDischarge} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tóm Tắt Tổng Kết Xuất Viện (Discharge Summary):</label>
                <textarea
                  required
                  rows={4}
                  value={dischargeSummary}
                  onChange={(e) => setDischargeSummary(e.target.value)}
                  placeholder="Ghi rõ tình trạng sức khỏe khi xuất viện, lời dặn bác sĩ, hẹn tái khám..."
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedDischargeAdmission(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-md"
                >
                  Hoàn Tất Xuất Viện
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
