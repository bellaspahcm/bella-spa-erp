'use client';

import React, { useState, useEffect } from 'react';
import {
  getMarketplacePacksAction,
  upgradePackVersionAction,
  updatePackStatusAction,
  requestPackReviewAction,
  type PackInstallationState,
} from '@/services/platform/marketplace-actions';
import { INDUSTRY_PACK_REGISTRY } from '@/platform/industry-registry';

export default function MarketplaceGovernancePage() {
  const [installedPacks, setInstalledPacks] = useState<PackInstallationState[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const res = await getMarketplacePacksAction();
    setInstalledPacks(res.data);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleUpgradeVersion = async (packId: string, currentVersion: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    // Simple upgrade step logic
    const versionParts = currentVersion.split('.').map(Number);
    versionParts[0] += 1; // Major version increment
    const targetVersion = versionParts.join('.');

    const res = await upgradePackVersionAction(packId, targetVersion);
    if (!res.success) {
      setErrorMsg(res.error);
    } else {
      setSuccessMsg(`Đã nâng cấp phân hệ thành công lên v${targetVersion}!`);
      void loadData();
    }
  };

  const handleRequestReview = async (packId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const res = await requestPackReviewAction(packId);
    if (!res.success) {
      setErrorMsg(res.error);
    } else {
      setSuccessMsg('Đã đệ trình phân hệ lên Hội đồng ARB phê duyệt.');
      void loadData();
    }
  };

  const handleDeprecatePack = async (packId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const res = await updatePackStatusAction(packId, 'deprecated');
    if (!res.success) {
      setErrorMsg(res.error);
    } else {
      setSuccessMsg('Đã đưa phân hệ vào lộ trình dừng cung cấp (Deprecated).');
      void loadData();
    }
  };

  // Helper status color
  const statusColor = (status: PackInstallationState['status']) => {
    const map: Record<PackInstallationState['status'], string> = {
      active: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300',
      review: 'bg-yellow-500/10 border-yellow-500/40 text-yellow-300',
      draft: 'bg-blue-500/10 border-blue-500/40 text-blue-300',
      deprecated: 'bg-rose-500/10 border-rose-500/40 text-rose-300',
      sunset: 'bg-slate-500/10 border-slate-500/40 text-slate-400',
    };
    return map[status] || 'bg-slate-500/10 text-slate-400';
  };

  return (
    <div className="min-h-screen text-slate-100" style={{ background: 'linear-gradient(135deg, #040914 0%, #080f21 50%, #091329 100%)' }}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ background: 'linear-gradient(135deg, #f43f5e, #fb7185)' }}
            >
              📦
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">EIP Industry Pack Marketplace</h1>
              <p className="text-sm text-rose-400">Governance & Release Life Cycle of Business Domains</p>
            </div>
          </div>
        </div>

        {/* Global Notifications */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/20 border border-red-500/30 text-sm text-red-300 font-semibold flex items-center gap-2">
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-sm text-emerald-300 font-semibold flex items-center gap-2">
            ✓ {successMsg}
          </div>
        )}

        {loading && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-3xl mb-2 animate-spin">⚙️</div>
            <p>Đang tải Marketplace Registry...</p>
          </div>
        )}

        {!loading && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {installedPacks.map((pack) => {
              // Fetch corresponding canonical manifest for description / static fields
              const registryManifest = INDUSTRY_PACK_REGISTRY[pack.packCode];
              return (
                <div
                  key={pack.id}
                  className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 hover:bg-white/8 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header line */}
                    <div className="flex items-start justify-between mb-3 gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono text-cyan-400 font-bold block">
                          {pack.packCode.toUpperCase()}
                        </span>
                        <h3 className="text-base font-bold text-white mt-0.5 truncate">
                          {registryManifest?.packName || pack.packCode}
                        </h3>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${statusColor(pack.status)}`}>
                        {pack.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Version & Freeze */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-slate-400 font-mono">v{pack.version}</span>
                      {pack.isFrozen && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 border border-amber-500/40 text-amber-300 flex items-center gap-1">
                          🔒 Frozen Vertical
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-xs text-gray-400 line-clamp-3 mb-4">
                      {registryManifest?.description || 'Không có mô tả phân hệ.'}
                    </p>

                    {/* Capabilities */}
                    <div className="mb-4">
                      <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">
                        Capabilities Included ({pack.enabledCapabilities.length})
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {pack.enabledCapabilities.slice(0, 4).map((cap) => (
                          <span
                            key={cap}
                            className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono"
                          >
                            {cap}
                          </span>
                        ))}
                        {pack.enabledCapabilities.length > 4 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-slate-500 font-mono">
                            +{pack.enabledCapabilities.length - 4}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Compliance & Countries */}
                    {(pack.complianceStandards.length > 0 || pack.countryPacks.length > 0) && (
                      <div className="mb-6 flex flex-wrap gap-2 border-t border-white/5 pt-3">
                        {pack.countryPacks.map((c) => (
                          <span key={c} className="text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20 px-1.5 py-0.5 rounded">
                            🌍 {c} Pack
                          </span>
                        ))}
                        {pack.complianceStandards.map((std) => (
                          <span key={std} className="text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                            ✓ {std}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions line */}
                  <div className="flex gap-2 border-t border-white/5 pt-4">
                    {pack.status === 'draft' && (
                      <button
                        onClick={() => handleRequestReview(pack.id)}
                        className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-yellow-600 hover:bg-yellow-700 text-white transition-all"
                      >
                        Submit Review
                      </button>
                    )}
                    {pack.status === 'active' && !pack.isFrozen && (
                      <button
                        onClick={() => handleUpgradeVersion(pack.id, pack.version)}
                        className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white transition-all"
                      >
                        Upgrade Major
                      </button>
                    )}
                    {pack.status === 'active' && pack.isFrozen && (
                      <div className="flex-1 text-center py-2 text-xs font-semibold bg-white/5 text-gray-500 rounded-xl cursor-not-allowed">
                        🔒 Version Locked
                      </div>
                    )}
                    {pack.status === 'active' && (
                      <button
                        onClick={() => handleDeprecatePack(pack.id)}
                        className="px-3 py-2 rounded-xl text-xs font-bold border border-white/10 hover:bg-white/5 text-slate-400 transition-all"
                      >
                        Deprecate
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
