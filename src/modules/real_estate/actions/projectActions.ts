'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import { ProjectService } from '../services/ProjectService';
import { Database } from '@/types/database.types';
import { revalidatePath } from 'next/cache';

type ProjectInsert = Database['public']['Tables']['real_estate_projects']['Insert'];
type ProjectRow = Database['public']['Tables']['real_estate_projects']['Row'];

export interface ProjectResult {
  success: boolean;
  data?: ProjectRow | ProjectRow[] | null;
  error?: string;
}

export async function fetchProjectsAction(): Promise<ProjectResult> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();
    
    if (!user || !user.tenant_id) {
      return { success: false, error: 'Unauthorized: Missing tenant context' };
    }

    const projects = await ProjectService.getProjects(supabase, user.tenant_id);
    return { success: true, data: projects };
  } catch (error) {
    console.error('[projectActions] Error in fetchProjectsAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'System error'
    };
  }
}

export async function createProjectAction(
  data: Omit<ProjectInsert, 'tenant_id'>
): Promise<ProjectResult> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user || !user.tenant_id) {
      return { success: false, error: 'Unauthorized: Missing tenant context' };
    }

    const project = await ProjectService.createProject(supabase, user.tenant_id, data);
    
    revalidatePath('/dashboard/real-estate/projects');
    return { success: true, data: project };
  } catch (error) {
    console.error('[projectActions] Error in createProjectAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'System error'
    };
  }
}
