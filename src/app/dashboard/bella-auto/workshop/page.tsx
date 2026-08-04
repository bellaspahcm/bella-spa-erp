'use client';

import { Suspense, useState, useEffect } from 'react';
import { ServiceCalendar } from '@/modules/bella-auto/components/workshop/ServiceCalendar';
import { RepairOrderBoard } from '@/modules/bella-auto/components/workshop/RepairOrderBoard';
import { TechnicianDashboard } from '@/modules/bella-auto/components/workshop/TechnicianDashboard';
import { Wrench, Calendar, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { mapAppointmentForCalendar, mapRepairOrderForBoard } from '@/modules/bella-auto/lib/workshop-mappers';

type TabType = 'appointments' | 'orders' | 'technicians';

export default function WorkshopPage() {
  const [activeTab, setActiveTab] = useState<TabType>('appointments');
  const [appointments, setAppointments] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Mock technicians data (auto_technicians table not created yet)
  const mockTechnicians = [
    {
      technicianId: '1',
      technicianName: 'Kỹ thuật viên X',
      role: 'Kỹ thuật viên chính',
      activeOrders: 2,
      totalHoursToday: 6.5,
      completedToday: 1,
      efficiency: 85,
      qualityScore: 92,
      currentJobs: [
        { orderNumber: 'RO20260803-0001', vehicleInfo: 'Toyota Camry', status: 'in_progress', progress: 60 },
        { orderNumber: 'RO20260803-0003', vehicleInfo: 'Mazda CX-5', status: 'diagnosed', progress: 20 },
      ],
    },
    {
      technicianId: '2',
      technicianName: 'Kỹ thuật viên Y',
      role: 'Kỹ thuật viên',
      activeOrders: 1,
      totalHoursToday: 3.0,
      completedToday: 2,
      efficiency: 90,
      qualityScore: 88,
      currentJobs: [{ orderNumber: 'RO20260803-0002', vehicleInfo: 'Honda Civic', status: 'in_progress', progress: 45 }],
    },
    {
      technicianId: '3',
      technicianName: 'Kỹ thuật viên Z',
      role: 'Kỹ thuật viên',
      activeOrders: 0,
      totalHoursToday: 5.5,
      completedToday: 3,
      efficiency: 95,
      qualityScore: 95,
      currentJobs: [],
    },
  ];

  // Fetch appointments and repair orders from Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const supabase = createClient();
        
        if (!supabase) {
          console.error('Supabase client not initialized');
          setIsLoading(false);
          return;
        }
        
        const [appointmentsRes, ordersRes] = await Promise.all([
          supabase.from('auto_service_appointments').select('*').order('scheduled_date', { ascending: true }),
          supabase.from('auto_repair_orders').select('*').order('opened_at', { ascending: false }),
        ]);

        if (appointmentsRes.error) {
          console.error('Appointments fetch error:', appointmentsRes.error);
          setAppointments([]);
        } else {
          // Map database format to component format
          const mappedAppointments = (appointmentsRes.data || []).map(mapAppointmentForCalendar);
          setAppointments(mappedAppointments);
        }
        
        if (ordersRes.error) {
          console.error('Orders fetch error:', ordersRes.error);
          setOrders([]);
        } else {
          // Map database format to component format
          const mappedOrders = (ordersRes.data || []).map(mapRepairOrderForBoard);
          setOrders(mappedOrders);
        }
      } catch (error) {
        console.error('Failed to fetch workshop data:', error);
        toast.error('Không thể tải dữ liệu workshop');
        setAppointments([]);
        setOrders([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="flex-1 overflow-auto bg-slate-50/30 dark:bg-slate-950 p-6 md:p-10 space-y-8" data-auto-layout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-900 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/15 dark:from-blue-500/20 dark:to-indigo-500/5 border border-blue-100/50 dark:border-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm shrink-0">
            <Wrench className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">
              Trung Tâm Dịch Vụ & Xưởng
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Hệ thống quản lý đặt lịch hẹn, phân bổ phiếu sửa chữa và tối ưu hóa năng suất kỹ thuật viên
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation (Premium Segmented Control Style) */}
      <div className="flex justify-start">
        <nav className="flex p-1.5 bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/40 rounded-2xl gap-1.5 shadow-sm">
          <button 
            onClick={() => setActiveTab('appointments')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ${
              activeTab === 'appointments' 
                ? 'bg-white dark:bg-slate-950 text-cyan-600 dark:text-cyan-400 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-200/20 dark:border-slate-800/30' 
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
            }`}
          >
            <Calendar className="h-4 w-4 shrink-0" />
            Lịch Hẹn
          </button>
          <button 
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ${
              activeTab === 'orders' 
                ? 'bg-white dark:bg-slate-950 text-cyan-600 dark:text-cyan-400 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-200/20 dark:border-slate-800/30' 
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
            }`}
          >
            <Wrench className="h-4 w-4 shrink-0" />
            Bảng Sửa Chữa
          </button>
          <button 
            onClick={() => setActiveTab('technicians')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ${
              activeTab === 'technicians' 
                ? 'bg-white dark:bg-slate-950 text-cyan-600 dark:text-cyan-400 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-200/20 dark:border-slate-800/30' 
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
            }`}
          >
            <Users className="h-4 w-4 shrink-0" />
            Kỹ Thuật Viên
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="transition-all duration-300">
        {activeTab === 'appointments' && (
          isLoading ? (
            <div className="flex items-center justify-center h-72 bg-white dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl">
              <div className="text-center space-y-4">
                <div className="w-10 h-10 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Đang tải lịch hẹn...</p>
              </div>
            </div>
          ) : (
            <ServiceCalendar
              appointments={appointments}
              onAppointmentClick={(apt) => {
                console.log('Appointment clicked:', apt);
              }}
            />
          )
        )}

        {activeTab === 'orders' && (
          isLoading ? (
            <div className="flex items-center justify-center h-72 bg-white dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl">
              <div className="text-center space-y-4">
                <div className="w-10 h-10 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Đang tải đơn sửa chữa...</p>
              </div>
            </div>
          ) : (
            <RepairOrderBoard
              orders={orders}
              onOrderClick={(order) => {
                console.log('Order clicked:', order);
              }}
            />
          )
        )}

        {activeTab === 'technicians' && (
          <TechnicianDashboard
            technicians={mockTechnicians}
            onTechnicianClick={(id) => {
              console.log('Technician clicked:', id);
            }}
          />
        )}
      </div>
    </div>
  );
}
