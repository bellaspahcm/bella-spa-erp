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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { LoaderIcon, EditIcon, Trash2Icon } from 'lucide-react';
import {
  updateGuardianRelationshipAction,
  removeGuardianAction,
} from '@/products/bella-preschool/actions/guardian-actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface GuardianData {
  id: string;
  relationship_type: string;
  is_primary: boolean;
  pickup_authorized: boolean;
  is_emergency_contact?: boolean;
  guardian_name: string;
}

interface EditGuardianDialogProps {
  guardian: GuardianData;
}

export function EditGuardianDialog({ guardian }: EditGuardianDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    relationship_type: guardian.relationship_type,
    is_primary: guardian.is_primary,
    is_emergency_contact: guardian.is_emergency_contact || false,
    pickup_authorized: guardian.pickup_authorized,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const result = await updateGuardianRelationshipAction(guardian.id, {
      relationship_type: formData.relationship_type as any,
      is_primary: formData.is_primary,
      is_emergency_contact: formData.is_emergency_contact,
      pickup_authorized: formData.pickup_authorized,
    });

    if (result.success) {
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error || 'Failed to update guardian');
    }

    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    const result = await removeGuardianAction(guardian.id);

    if (result.success) {
      setShowDeleteConfirm(false);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error || 'Failed to remove guardian');
      setShowDeleteConfirm(false);
    }

    setIsDeleting(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <EditIcon className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Guardian Relationship</DialogTitle>
            <DialogDescription>
              Update relationship details for {guardian.guardian_name}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Display */}
            {error && (
              <div className="rounded-md bg-red-50 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Relationship Type */}
            <div>
              <Label htmlFor="relationship_type">Relationship</Label>
              <Select
                value={formData.relationship_type}
                onValueChange={(value) =>
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

            {/* Checkboxes */}
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

            {/* Actions */}
            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSubmitting || isDeleting}
              >
                <Trash2Icon className="w-4 h-4 mr-2" />
                Remove Guardian
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Guardian?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unlink {guardian.guardian_name} from this student. The contact
              information will remain in the system but will no longer be associated with
              this student.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />}
              Remove Guardian
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
