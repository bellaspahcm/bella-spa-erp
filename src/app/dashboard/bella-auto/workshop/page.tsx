'use client';

import { Suspense, useState, useEffect } from 'react';
import { ServiceCalendar } from '@/modules/bella-auto/components/workshop/ServiceCalendar';
import { RepairOrderBoard } from '@/modules/bella-auto/components/workshop/RepairOrderBoard';
import { TechnicianDashboard } from '@/modules/bella-auto/components/workshop/TechnicianDashboard';
import { Wrench, Calendar, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { toast } from 'sonner';

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
          // Don't throw - just log and continue with empty data
          setAppointments([]);
        } else {
          setAppointments(appointmentsRes.data || []);
        }
        
        if (ordersRes.error) {
          console.error('Orders fetch error:', ordersRes.error);
          setOrders([]);
        } else {
          setOrders(ordersRes.data || []);
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
    <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-950 p-6 md:p-10 space-y-8" data-auto-layout>
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wrench className="h-6 w-6 text-blue-600" />
            Trung Tâm Dịch Vụ & Xưởng
          </h1>
          <p className="text-gray-600 mt-1">
            Quản lý lịch hẹn, sửa chữa và kỹ thuật viên
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          <button 
            onClick={() => setActiveTab('appointments')}
            className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'appointments' 
                ? 'border-cyan-600 text-cyan-600' 
                : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Calendar className="h-4 w-4 inline-block mr-2" />
            Lịch Hẹn
          </button>
          <button 
            onClick={() => setActiveTab('orders')}
            className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'orders' 
                ? 'border-cyan-600 text-cyan-600' 
                : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Wrench className="h-4 w-4 inline-block mr-2" />
            Bảng Sửa Chữa
          </button>
          <button 
            onClick={() => setActiveTab('technicians')}
            className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'technicians' 
                ? 'border-cyan-600 text-cyan-600' 
                : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Users className="h-4 w-4 inline-block mr-2" />
            Kỹ Thuật Viên
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'appointments' && (
        isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Đang tải lịch hẹn...</p>
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
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Đang tải đơn sửa chữa...</p>
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
  );
}
