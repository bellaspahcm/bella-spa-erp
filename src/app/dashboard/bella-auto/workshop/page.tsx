import { Suspense } from 'react';
import { ServiceCalendar } from '@/modules/bella-auto/components/workshop/ServiceCalendar';
import { RepairOrderBoard } from '@/modules/bella-auto/components/workshop/RepairOrderBoard';
import { TechnicianDashboard } from '@/modules/bella-auto/components/workshop/TechnicianDashboard';
import { Wrench, Calendar, Users } from 'lucide-react';

export default function WorkshopPage() {
  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
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
      <div className="border-b">
        <nav className="flex gap-6">
          <button className="pb-3 px-1 border-b-2 border-blue-600 font-medium text-blue-600">
            <Calendar className="h-4 w-4 inline-block mr-2" />
            Lịch Hẹn
          </button>
          <button className="pb-3 px-1 border-b-2 border-transparent font-medium text-gray-600 hover:text-gray-900">
            <Wrench className="h-4 w-4 inline-block mr-2" />
            Bảng Sửa Chữa
          </button>
          <button className="pb-3 px-1 border-b-2 border-transparent font-medium text-gray-600 hover:text-gray-900">
            <Users className="h-4 w-4 inline-block mr-2" />
            Kỹ Thuật Viên
          </button>
        </nav>
      </div>

      {/* Content - Service Calendar */}
      <Suspense fallback={<LoadingState />}>
        <ServiceCalendarSection />
      </Suspense>

      {/* Repair Order Board */}
      <Suspense fallback={<LoadingState />}>
        <RepairOrderBoardSection />
      </Suspense>

      {/* Technician Dashboard */}
      <Suspense fallback={<LoadingState />}>
        <TechnicianDashboardSection />
      </Suspense>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="bg-white rounded-lg shadow p-8">
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-gray-200 rounded w-1/4" />
        <div className="h-32 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

async function ServiceCalendarSection() {
  // TODO: Fetch appointments from API
  const mockAppointments = [
    {
      id: '1',
      appointmentNumber: 'APT20260803-0001',
      customerName: 'Nguyễn Văn A',
      vehicleInfo: 'Toyota Camry 2023',
      licensePlate: '30A-12345',
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledTime: '09:00:00',
      serviceType: 'Bảo dưỡng định kỳ',
      status: 'confirmed',
      serviceAdvisorName: 'Trần Thị B',
      estimatedDuration: 2,
    },
    {
      id: '2',
      appointmentNumber: 'APT20260803-0002',
      customerName: 'Lê Thị C',
      vehicleInfo: 'Honda Civic 2022',
      licensePlate: '51F-67890',
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledTime: '10:00:00',
      serviceType: 'Sửa chữa động cơ',
      status: 'checked_in',
      serviceAdvisorName: 'Phạm Văn D',
      estimatedDuration: 4,
    },
  ];

  return (
    <ServiceCalendar
      appointments={mockAppointments}
      onAppointmentClick={(apt) => {
        console.log('Appointment clicked:', apt);
      }}
    />
  );
}

async function RepairOrderBoardSection() {
  // TODO: Fetch repair orders from API
  const mockOrders = [
    {
      id: '1',
      orderNumber: 'RO20260803-0001',
      customerName: 'Nguyễn Văn A',
      vehicleInfo: 'Toyota Camry 2023',
      licensePlate: '30A-12345',
      orderType: 'Bảo dưỡng',
      status: 'in_progress',
      priority: 'normal' as const,
      primaryTechnicianName: 'Kỹ thuật viên X',
      estimatedHours: 2,
      actualHours: 1.5,
      openedAt: new Date().toISOString(),
      bayNumber: '3',
    },
    {
      id: '2',
      orderNumber: 'RO20260803-0002',
      customerName: 'Lê Thị C',
      vehicleInfo: 'Honda Civic 2022',
      licensePlate: '51F-67890',
      orderType: 'Sửa chữa',
      status: 'diagnosed',
      priority: 'high' as const,
      primaryTechnicianName: 'Kỹ thuật viên Y',
      estimatedHours: 4,
      openedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
  ];

  return (
    <RepairOrderBoard
      orders={mockOrders}
      onOrderClick={(order) => {
        console.log('Order clicked:', order);
      }}
    />
  );
}

async function TechnicianDashboardSection() {
  // TODO: Fetch technician workload from API
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
        {
          orderNumber: 'RO20260803-0001',
          vehicleInfo: 'Toyota Camry',
          status: 'in_progress',
          progress: 60,
        },
        {
          orderNumber: 'RO20260803-0003',
          vehicleInfo: 'Mazda CX-5',
          status: 'diagnosed',
          progress: 20,
        },
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
      currentJobs: [
        {
          orderNumber: 'RO20260803-0002',
          vehicleInfo: 'Honda Civic',
          status: 'in_progress',
          progress: 45,
        },
      ],
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

  return (
    <TechnicianDashboard
      technicians={mockTechnicians}
      onTechnicianClick={(id) => {
        console.log('Technician clicked:', id);
      }}
    />
  );
}
