'use client';

import React, { useEffect, useState } from 'react';
import { useHealthcareKernel } from '@/modules/bella-healthcare-kernel/context/HealthcareKernelContext';
import type { ResourceQueryCapability } from '@/modules/bella-healthcare-kernel/capabilities/query-capability';
import type { HealthcareResourceDTO } from '@/modules/bella-healthcare-kernel/domain/types';

export const RoomGridWidget: React.FC = () => {
  const { capabilityRegistry } = useHealthcareKernel();
  const [rooms, setRooms] = useState<readonly HealthcareResourceDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchRooms() {
      try {
        const queryCap = capabilityRegistry.get<ResourceQueryCapability>('medical_resource_query');
        const data = await queryCap.getResources('default_tenant');
        setRooms(data);
      } catch (err) {
        console.error('[RoomGridWidget] Failed to fetch rooms:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchRooms();
  }, [capabilityRegistry]);

  if (loading) {
    return <div className="p-4 text-slate-400">Đang tải danh sách phòng khám...</div>;
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span>🏥</span> Danh Sách Phòng Khám Đa Khoa
        </h3>
        <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full">
          {rooms.length} phòng đang hoạt động
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {rooms.map((room) => (
          <div
            key={room.id}
            className="p-4 bg-slate-800/60 border border-slate-700/50 rounded-lg hover:border-emerald-500/40 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-sm font-semibold text-emerald-400">{room.code}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  room.status === 'available'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {room.status === 'available' ? 'Sẵn sàng' : 'Đang khám'}
              </span>
            </div>
            <div className="text-sm font-medium text-slate-200">{room.name}</div>
            <div className="text-xs text-slate-400 mt-1">Chuyên khoa: {room.department}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
