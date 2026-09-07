'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { SearchIcon, LoaderIcon, PlusIcon } from 'lucide-react';
import {
  searchCustomersAction,
  addGuardianAction,
} from '@/products/bella-preschool/actions/guardian-actions';

interface AddGuardianDialogProps {
  studentId: string;
}

export function AddGuardianDialog({ studentId }: AddGuardianDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    relationship_type: 'parent' as 'parent' | 'grandparent' | 'guardian' | 'other',
    is_primary: false,
    is_emergency_contact: false,
    pickup_authorized: true,
  });

  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    const result = await searchCustomersAction(searchQuery);
    if (result.success) {
      setSearchResults(result.data || []);
    } else {
      setError(result.error || 'Search failed');
    }

    setIsSearching(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      setError('Please select a guardian');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await addGuardianAction({
      student_id: studentId,
      guardian_customer_id: selectedCustomer.id,
      relationship_type: formData.relationship_type,
      is_primary: formData.is_primary,
      is_emergency_contact: formData.is_emergency_contact,
      pickup_authorized: formData.pickup_authorized,
    });

    if (result.success) {
      setOpen(false);
      router.refresh();
      // Reset form
      setSearchQuery('');
      setSearchResults([]);
      setSelectedCustomer(null);
      setFormData({
        relationship_type: 'parent',
        is_primary: false,
        is_emergency_contact: false,
        pickup_authorized: true,
      });
    } else {
      setError(result.error || 'Failed to add guardian');
    }

    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Guardian
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Guardian</DialogTitle>
          <DialogDescription>
            Search for an existing contact or create a new one
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Display */}
          {error && (
            <div className="rounded-md bg-red-50 p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Search Customer */}
          <div className="space-y-2">
            <Label>Search Contact</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Search by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleSearch}
                disabled={isSearching}
              >
                {isSearching ? (
                  <LoaderIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <SearchIcon className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="border rounded-md max-h-40 overflow-y-auto">
              {searchResults.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(customer);
                    setSearchResults([]);
                    setSearchQuery('');
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0"
                >
                  <div className="font-medium">{customer.name}</div>
                  {customer.phone && (
                    <div className="text-sm text-gray-600">{customer.phone}</div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Selected Customer */}
          {selectedCustomer && (
            <div className="border rounded-md p-3 bg-green-50">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{selectedCustomer.name}</div>
                  {selectedCustomer.phone && (
                    <div className="text-sm text-gray-600">
                      {selectedCustomer.phone}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCustomer(null)}
                >
                  Change
                </Button>
              </div>
            </div>
          )}

          {/* Relationship Details */}
          {selectedCustomer && (
            <>
              <div>
                <Label htmlFor="relationship_type">Relationship</Label>
                <Select
                  value={formData.relationship_type}
                  onValueChange={(value: any) =>
                    setFormData((prev) => ({ ...prev, relationship_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parent">Parent</SelectItem>
                    <SelectItem value="grandparent">Grandparent</SelectItem>
                    <SelectItem value="guardian">Legal Guardian</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_primary"
                    checked={formData.is_primary}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        is_primary: checked === true,
                      }))
                    }
                  />
                  <Label htmlFor="is_primary" className="font-normal cursor-pointer">
                    Primary Contact
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_emergency_contact"
                    checked={formData.is_emergency_contact}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        is_emergency_contact: checked === true,
                      }))
                    }
                  />
                  <Label
                    htmlFor="is_emergency_contact"
                    className="font-normal cursor-pointer"
                  >
                    Emergency Contact
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="pickup_authorized"
                    checked={formData.pickup_authorized}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        pickup_authorized: checked === true,
                      }))
                    }
                  />
                  <Label
                    htmlFor="pickup_authorized"
                    className="font-normal cursor-pointer"
                  >
                    Authorized for Pickup
                  </Label>
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!selectedCustomer || isSubmitting}>
              {isSubmitting && (
                <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
              )}
              Add Guardian
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
