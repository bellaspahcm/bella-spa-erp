import { Database } from '@/types/database.types';
import { SupabaseClient } from '@supabase/supabase-js';

type ProjectInsert = Database['public']['Tables']['real_estate_projects']['Insert'];
type ProjectRow = Database['public']['Tables']['real_estate_projects']['Row'];

export class ProjectService {
  /**
   * Fetch all projects for a given tenant
   */
  static async getProjects(
    supabase: SupabaseClient<Database>,
    tenantId: string
  ): Promise<ProjectRow[]> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const { data, error } = await supabase
      .from('real_estate_projects')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (error) {
      console.error('[ProjectService] Error fetching projects:', error.message);
      throw error;
    }

    return data || [];
  }

  /**
   * Create a new project under the tenant
   */
  static async createProject(
    supabase: SupabaseClient<Database>,
    tenantId: string,
    data: Omit<ProjectInsert, 'tenant_id'>
  ): Promise<ProjectRow> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    if (!data.name) {
      throw new Error('Project name is required');
    }

    const { data: project, error } = await supabase
      .from('real_estate_projects')
      .insert({
        ...data,
        tenant_id: tenantId,
      } as ProjectInsert)
      .select()
      .single();

    if (error) {
      console.error('[ProjectService] Error creating project:', error.message);
      throw error;
    }

    return project;
  }
}
