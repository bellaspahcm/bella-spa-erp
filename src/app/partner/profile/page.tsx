/**
 * Partner Portal - Profile Module
 * Hồ sơ đối tác, thông tin ngân hàng & bảo mật
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/services/user-actions';
import { 
  fetchPartnerProfile, 
  updatePartnerProfile,
  updateBankAccount,
  changePassword 
} from '@/services/partner-actions';

interface PartnerProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  partner_code: string;
  partner_type: 'F1' | 'F2' | 'CTV';
  company_name?: string;
  tax_code?: string;
  address?: string;
  bank_account?: {
    bank_name: string;
    account_number: string;
    account_holder: string;
    branch?: string;
  };
  created_at: string;
}

const PARTNER_TYPE_LABELS = {
  F1: 'Đại lý F1',
  F2: 'Đại lý F2',
  CTV: 'Cộng tác viên',
};

export default function PartnerProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'bank' | 'security'>('info');
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const user = await getCurrentUser();
      if (!user) {
        router.push('/login');
        return;
      }
      await loadProfile(user.id);
    };
    void loadUser();
  }, [router]);

  const loadProfile = async (userId: string) => {
    try {
      setLoading(true);
      const data = await fetchPartnerProfile(userId);
      setProfile(data);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (formData: FormData) => {
    if (!profile) return;

    try {
      setSaving(true);
      await updatePartnerProfile(profile.id, {
        full_name: formData.get('full_name') as string,
        phone: formData.get('phone') as string,
        company_name: formData.get('company_name') as string || undefined,
        tax_code: formData.get('tax_code') as string || undefined,
        address: formData.get('address') as string || undefined,
      });

      await loadProfile(profile.id);
      setEditMode(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Cập nhật thông tin thất bại. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBankAccount = async (formData: FormData) => {
    if (!profile) return;

    try {
      setSaving(true);
      await updateBankAccount(profile.id, {
        bank_name: formData.get('bank_name') as string,
        account_number: formData.get('account_number') as string,
        account_holder: formData.get('account_holder') as string,
        branch: formData.get('branch') as string || undefined,
      });

      await loadProfile(profile.id);
      alert('Cập nhật tài khoản ngân hàng thành công!');
    } catch (error) {
      console.error('Failed to update bank account:', error);
      alert('Cập nhật tài khoản ngân hàng thất bại. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (formData: FormData) => {
    const currentPassword = formData.get('current_password') as string;
    const newPassword = formData.get('new_password') as string;
    const confirmPassword = formData.get('confirm_password') as string;

    if (newPassword !== confirmPassword) {
      alert('Mật khẩu xác nhận không khớp!');
      return;
    }

    if (newPassword.length < 8) {
      alert('Mật khẩu mới phải có ít nhất 8 ký tự!');
      return;
    }

    try {
      setSaving(true);
      await changePassword(currentPassword, newPassword);
      alert('Đổi mật khẩu thành công!');
      (document.querySelector('form[name="change-password"]') as HTMLFormElement)?.reset();
    } catch (error) {
      console.error('Failed to change password:', error);
      alert('Đổi mật khẩu thất bại. Vui lòng kiểm tra mật khẩu hiện tại.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-20">
        <p className="text-gray-500">Không tìm thấy thông tin hồ sơ</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="px-4 py-6">
          <h1 className="text-xl font-bold mb-2">{profile.full_name}</h1>
          <p className="text-sm text-blue-100">
            {PARTNER_TYPE_LABELS[profile.partner_type]} • Mã ĐT: {profile.partner_code}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex px-4">
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'info'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Thông tin
          </button>
          <button
            onClick={() => setActiveTab('bank')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'bank'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Ngân hàng
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'security'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Bảo mật
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Info Tab */}
        {activeTab === 'info' && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Thông Tin Cá Nhân</h2>
              {!editMode && (
                <button
                  onClick={() => setEditMode(true)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Chỉnh sửa
                </button>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                void handleSaveProfile(formData);
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Họ và tên
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    defaultValue={profile.full_name}
                    disabled={!editMode}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    defaultValue={profile.email}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Email không thể thay đổi</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    defaultValue={profile.phone}
                    disabled={!editMode}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>

                {profile.partner_type !== 'CTV' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tên công ty
                      </label>
                      <input
                        type="text"
                        name="company_name"
                        defaultValue={profile.company_name || ''}
                        disabled={!editMode}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Mã số thuế
                      </label>
                      <input
                        type="text"
                        name="tax_code"
                        defaultValue={profile.tax_code || ''}
                        disabled={!editMode}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Địa chỉ
                  </label>
                  <textarea
                    name="address"
                    defaultValue={profile.address || ''}
                    disabled={!editMode}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
              </div>

              {editMode && (
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setEditMode(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {saving ? 'Đang lưu...' : 'Lưu'}
                  </button>
                </div>
              )}
            </form>
          </div>
        )}

        {/* Bank Tab */}
        {activeTab === 'bank' && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Tài Khoản Ngân Hàng
            </h2>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                void handleSaveBankAccount(formData);
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên ngân hàng
                  </label>
                  <input
                    type="text"
                    name="bank_name"
                    defaultValue={profile.bank_account?.bank_name || ''}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="VD: Vietcombank"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số tài khoản
                  </label>
                  <input
                    type="text"
                    name="account_number"
                    defaultValue={profile.bank_account?.account_number || ''}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0123456789"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chủ tài khoản
                  </label>
                  <input
                    type="text"
                    name="account_holder"
                    defaultValue={profile.bank_account?.account_holder || ''}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="NGUYEN VAN A"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chi nhánh (không bắt buộc)
                  </label>
                  <input
                    type="text"
                    name="branch"
                    defaultValue={profile.bank_account?.branch || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="VD: Chi nhánh TP.HCM"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {saving ? 'Đang lưu...' : 'Cập nhật'}
              </button>
            </form>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Đổi Mật Khẩu</h2>

            <form
              name="change-password"
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                void handleChangePassword(formData);
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mật khẩu hiện tại
                  </label>
                  <input
                    type="password"
                    name="current_password"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mật khẩu mới
                  </label>
                  <input
                    type="password"
                    name="new_password"
                    required
                    minLength={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Tối thiểu 8 ký tự</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Xác nhận mật khẩu mới
                  </label>
                  <input
                    type="password"
                    name="confirm_password"
                    required
                    minLength={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {saving ? 'Đang xử lý...' : 'Đổi mật khẩu'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
