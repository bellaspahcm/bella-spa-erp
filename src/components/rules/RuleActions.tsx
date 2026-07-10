'use client';

/**
 * Rule Actions Component
 * 
 * Dropdown menu with row actions:
 * - View: Navigate to rule detail
 * - Edit: Navigate to edit page
 * - Test: Navigate to test simulator
 * - Versions: Navigate to version history
 * - Archive: Archive rule (with confirmation)
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Eye, Edit, TestTube, History, Archive } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { toast } from 'sonner';

interface RuleActionsProps {
  rule: {
    id: string;
    name: string;
    status: string;
  };
}

export function RuleActions({ rule }: RuleActionsProps) {
  const router = useRouter();
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const handleView = () => {
    router.push(`/dashboard/rules/${rule.id}`);
  };

  const handleEdit = () => {
    router.push(`/dashboard/rules/${rule.id}/edit`);
  };

  const handleTest = () => {
    router.push(`/dashboard/rules/${rule.id}/test`);
  };

  const handleVersions = () => {
    router.push(`/dashboard/rules/${rule.id}/versions`);
  };

  const handleArchive = async () => {
    setIsArchiving(true);

    try {
      const response = await fetch(`/api/rules/${rule.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'archived',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to archive rule');
      }

      toast.success('Rule archived successfully');
      router.refresh();
    } catch (error) {
      console.error('Archive error:', error);
      toast.error('Failed to archive rule');
    } finally {
      setIsArchiving(false);
      setShowArchiveDialog(false);
    }
  };

  const isArchived = rule.status === 'archived';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={handleView}>
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </DropdownMenuItem>

          {!isArchived && (
            <>
              <DropdownMenuItem onClick={handleEdit}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Rule
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleTest}>
                <TestTube className="mr-2 h-4 w-4" />
                Test Rule
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuItem onClick={handleVersions}>
            <History className="mr-2 h-4 w-4" />
            Version History
          </DropdownMenuItem>

          {!isArchived && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowArchiveDialog(true)}
                className="text-destructive focus:text-destructive"
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Rule?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive <strong>{rule.name}</strong>?
              <br />
              Archived rules will no longer process decisions but can be restored later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={isArchiving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isArchiving ? 'Archiving...' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
