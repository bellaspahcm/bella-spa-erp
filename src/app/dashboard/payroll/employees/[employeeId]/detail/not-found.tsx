export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8">
      <h2 className="text-xl font-bold text-orange-600">Không tìm thấy trang chi tiết lương</h2>
      <p className="text-gray-500 text-sm">Route: /dashboard/payroll/employees/[id]/detail đã được load nhưng not-found được trigger</p>
    </div>
  );
}
