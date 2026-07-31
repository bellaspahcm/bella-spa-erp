'use client';

import React, { useEffect, useState } from 'react';
import { fetchProjectsAction, createProjectAction } from '@/modules/real_estate/actions/projectActions';
import { Database } from '@/types/database.types';
import { FolderKanban, PlusCircle, Building, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type ProjectRow = Database['public']['Tables']['real_estate_projects']['Row'];

export default function RealEstateProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '' });

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setIsLoading(true);
    const res = await fetchProjectsAction();
    if (res.success && res.data) {
      setProjects(Array.isArray(res.data) ? res.data : [res.data]);
    }
    setIsLoading(false);
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newProject.name) {
      toast.error('Vui lòng điền tên dự án');
      return;
    }

    const res = await createProjectAction({
      name: newProject.name,
      description: newProject.description,
      status: 'planning',
    });

    if (res.success) {
      toast.success('Tạo dự án thành công');
      setShowAddModal(false);
      setNewProject({ name: '', description: '' });
      loadProjects();
    } else {
      toast.error(res.error || 'Lỗi khi tạo dự án');
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FolderKanban className="text-primary w-7 h-7" />
            Dự Án Bất Động Sản
          </h1>
          <p className="text-sm text-slate-500">Quản lý danh sách các dự án đang triển khai</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-semibold rounded-xl hover:bg-primary-hover transition"
        >
          <PlusCircle className="w-5 h-5" />
          Tạo Dự Án Mới
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {projects.map((proj) => (
          <div key={proj.id} className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full">
                ACTIVE
              </span>
              <span className="text-xs text-slate-400">
                {proj.status === 'planning' ? 'Đang quy hoạch' : 'Đang mở bán'}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <Building className="w-5 h-5 text-slate-400" />
                {proj.name}
              </h3>
              <p className="text-sm text-slate-500 mt-2 line-clamp-2">{proj.description || 'Không có mô tả'}</p>
            </div>
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                Việt Nam
              </span>
              <span>Chi nhánh BELLA Group</span>
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 space-y-4">
            <h2 className="text-xl font-bold">Thêm Dự Án Mới</h2>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500">Tên Dự Án</label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  placeholder="Ví dụ: Bella Gold Tower"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">Mô Tả</label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl h-24"
                  placeholder="Mô tả sơ lược về dự án..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-sm font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-hover text-sm font-semibold"
                >
                  Xác Nhận
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
