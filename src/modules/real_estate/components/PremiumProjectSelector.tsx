'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Building2, MapPin, ChevronDown, Check, Sparkles, Layers } from 'lucide-react';
import { Database } from '@/types/supabase';

type ProjectRow = Database['public']['Tables']['real_estate_projects']['Row'];

interface PremiumProjectSelectorProps {
  projects: ProjectRow[];
  selectedProject: ProjectRow | null;
  onSelectProject: (project: ProjectRow) => void;
}

export const PremiumProjectSelector: React.FC<PremiumProjectSelectorProps> = ({
  projects,
  selectedProject,
  onSelectProject,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!projects || projects.length === 0) return null;

  return (
    <div className="relative z-30" ref={dropdownRef}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white border border-slate-200/90 rounded-2xl shadow-lg shadow-slate-200/50">
        {/* Label & Active Context */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-200/80 shadow-sm">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Đang Chọn Dự Án</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/80">
                <Sparkles className="w-3 h-3 text-amber-600" />
                Dự Án Trọng Điểm
              </span>
            </div>
            <h2 className="text-base font-black text-slate-900 mt-0.5">
              {selectedProject ? selectedProject.name : 'Vui lòng chọn dự án...'}
            </h2>
          </div>
        </div>

        {/* Custom Premium Dropdown Button */}
        <div className="relative min-w-[280px] sm:min-w-[360px]">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={`w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100/80 border transition-all duration-200 rounded-xl shadow-sm text-left ${
              isOpen
                ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-md shadow-indigo-500/10'
                : 'border-slate-300 hover:border-indigo-400'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
              <div className="truncate">
                <div className="text-sm font-extrabold text-slate-900 truncate">
                  {selectedProject ? selectedProject.name : 'Chọn dự án'}
                </div>
                {selectedProject?.location && (
                  <div className="text-xs text-slate-600 font-semibold flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                    <span>{selectedProject.location}</span>
                  </div>
                )}
              </div>
            </div>

            <ChevronDown
              className={`w-5 h-5 text-slate-500 shrink-0 transition-transform duration-300 ${
                isOpen ? 'rotate-180 text-indigo-600' : ''
              }`}
            />
          </button>

          {/* Premium Animated Dropdown Menu */}
          {isOpen && (
            <div className="absolute right-0 mt-2 w-full bg-white border border-slate-200/90 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-3 border-b border-slate-100 bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider flex justify-between items-center">
                <span>Danh Sách Dự Án Bất Động Sản ({projects.length})</span>
                <span className="text-indigo-600 font-mono font-extrabold">BELLA LAND</span>
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
                {projects.map((proj) => {
                  const isSelected = selectedProject?.id === proj.id;

                  return (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => {
                        onSelectProject(proj);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-3.5 transition-colors text-left group ${
                        isSelected
                          ? 'bg-indigo-50/80 text-slate-900'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-xl border mt-0.5 transition-colors ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-slate-100 text-slate-500 border-slate-200 group-hover:text-indigo-600 group-hover:border-indigo-200'
                          }`}
                        >
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className={`text-sm font-extrabold ${isSelected ? 'text-indigo-900' : 'text-slate-900 group-hover:text-indigo-600'}`}>
                            {proj.name}
                          </div>
                          {proj.location && (
                            <div className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-rose-500" />
                              <span>{proj.location}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <div className="p-1 bg-indigo-600 text-white rounded-full shadow-sm">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
