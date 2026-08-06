'use client';

import React, { useEffect, useState } from 'react';
import { useHealthcareKernel } from '@/modules/bella-healthcare-kernel/context/HealthcareKernelContext';
import type { ResourceQueryCapability } from '@/modules/bella-healthcare-kernel/capabilities/query-capability';
import type { HealthcareResourceDTO } from '@/modules/bella-healthcare-kernel/domain/types';

export const ChairGridWidget: React.FC = () => {
  const { capabilityRegistry } = useHealthcareKernel();
  const [chairs, setChairs] = useState<readonly HealthcareResourceDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchChairs() {
      try {
        const queryCap = capabilityRegistry.get<ResourceQueryCapability>('dental_resource_query');
        const data = await queryCap.getResources('default_tenant');
        setChairs(data);
      } catch (err) {
        console.error('[ChairGridWidget] Failed to fetch chairs:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchChairs();
  }, [capabilityRegistry]);

  if (loading) {
    return <div className="p-4 text-slate-400">Đang tải sơ đồ ghế nha khoa...</div>;
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span>🦷</span> Sơ Đồ Ghế Điều Trị Nha Khoa
        </h3>
        <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2.5 py-1 rounded-full">
          {chairs.length} ghế điều trị
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {chairs.map((chair) => (
          <div
            key={chair.id}
            className="p-4 bg-slate-800/60 border border-slate-700/50 rounded-lg hover:border-cyan-500/40 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-sm font-semibold text-cyan-400">{chair.code}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  chair.status === 'available'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {chair.status === 'available' ? 'Sẵn sàng' : 'Đang điều trị'}
              </span>
            </div>
            <div className="text-sm font-medium text-slate-200">{chair.name}</div>
            <div className="text-xs text-slate-400 mt-1">Chuyên khoa: {chair.department}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
