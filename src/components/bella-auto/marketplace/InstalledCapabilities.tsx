/**
 * Bella Auto - Installed Capabilities
 * Phase 14: View and manage installed capabilities
 */

'use client';

import { useState, useEffect } from 'react';
import { Settings, Trash2, AlertCircle, CheckCircle } from 'lucide-react';

export interface InstalledCapability {
  id: string;
  capabilityId: string;
  capabilityName: string;
  capabilityCode: string;
  version: string;
  status: 'pending' | 'installing' | 'active' | 'failed' | 'uninstalling';
  installedAt: string;
  isEnabled: boolean;
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy';
  healthMessage?: string;
}

export interface InstalledCapabilitiesProps {
  tenantId: string;
  onConfigure: (installationId: string) => void;
  onUninstall: (installationId: string) => void;
}

export function InstalledCapabilities({
  tenantId,
  onConfigure,
  onUninstall,
}: InstalledCapabilitiesProps) {
  const [installations, setInstallations] = useState<InstalledCapability[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchInstallations() {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API
      // const response = await fetch(`/api/bella-auto/marketplace/installed?tenant_id=${tenantId}`);
      // const data = await response.json();

      // Mock data
      const mockInstallations: InstalledCapability[] = [
        {
          id: 'inst-1',
          capabilityId: '1',
          capabilityName: 'Customer Journey Engine',
          capabilityCode: 'journey_engine',
          version: '1.0.0',
          status: 'active',
          installedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          isEnabled: true,
          healthStatus: 'healthy',
        },
        {
          id: 'inst-2',
          capabilityId: '5',
          capabilityName: 'Business Rule Engine',
          capabilityCode: 'rule_engine',
          version: '1.2.0',
          status: 'active',
          installedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          isEnabled: true,
          healthStatus: 'healthy',
        },
      ];

      setInstallations(mockInstallations);
    } catch (error) {
      console.error('Failed to fetch installations:', error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchInstallations();
  }, [tenantId]);

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-gray-100 text-gray-700',
      installing: 'bg-blue-100 text-blue-700',
      active: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
      uninstalling: 'bg-yellow-100 text-yellow-700',
    };
    return badges[status as keyof typeof badges] || badges.pending;
  };

  const getHealthIcon = (health?: string) => {
    if (health === 'healthy') return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (health === 'degraded') return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    if (health === 'unhealthy') return <AlertCircle className="w-5 h-5 text-red-600" />;
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Capabilities đã cài đặt</h2>
        <p className="text-sm text-gray-600 mt-1">
          Quản lý và cấu hình các capabilities
        </p>
      </div>

      {installations.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
          <p className="text-gray-600">Chưa cài đặt capability nào</p>
          <p className="text-sm text-gray-500 mt-1">
            Truy cập Marketplace để cài đặt
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {installations.map((install) => (
            <div
              key={install.id}
              className="bg-white border border-gray-200 rounded-lg p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">
                      {install.capabilityName}
                    </h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(install.status)}`}>
                      {install.status}
                    </span>
                    {install.healthStatus && getHealthIcon(install.healthStatus)}
                  </div>

                  <div className="text-sm text-gray-600 space-y-1">
                    <p>
                      <strong>Code:</strong> {install.capabilityCode}
                    </p>
                    <p>
                      <strong>Version:</strong> {install.version}
                    </p>
                    <p>
                      <strong>Cài đặt:</strong>{' '}
                      {new Date(install.installedAt).toLocaleDateString('vi-VN')}
                    </p>
                    {install.healthMessage && (
                      <p className="text-yellow-700">
                        <strong>⚠️</strong> {install.healthMessage}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  <button
                    onClick={() => onConfigure(install.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    <Settings className="w-4 h-4" />
                    Cấu hình
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Xác nhận gỡ cài đặt ${install.capabilityName}?`)) {
                        onUninstall(install.id);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-md hover:bg-red-100"
                  >
                    <Trash2 className="w-4 h-4" />
                    Gỡ cài đặt
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>{installations.length}</strong> capabilities đang hoạt động
        </p>
      </div>
    </div>
  );
}
