'use client';

/**
 * Add Service Item Button with Modal
 * 
 * Opens modal to add a new service item to booking
 */

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { AddServiceItemForm } from './AddServiceItemForm';

interface Package {
  id: string;
  name: string;
  price: number | null;
}

interface KTV {
  id: string;
  full_name: string;
}

interface AddServiceItemButtonProps {
  bookingId: string;
  tenantId: string;
  packages: Package[];
  ktvList?: KTV[];
}

export function AddServiceItemButton({ bookingId, tenantId, packages, ktvList = [] }: AddServiceItemButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Plus className="h-4 w-4" />
        Thêm dịch vụ
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative w-full max-w-2xl rounded-lg bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Thêm dịch vụ mới</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded p-1 hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <AddServiceItemForm
              bookingId={bookingId}
              tenantId={tenantId}
              packages={packages}
              ktvList={ktvList}
              onSuccess={() => {
                setIsOpen(false);
              }}
              onCancel={() => setIsOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
