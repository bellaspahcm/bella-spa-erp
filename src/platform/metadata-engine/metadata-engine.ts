import { supabase as typedSupabase } from '@/lib/supabase';
const supabase = typedSupabase as unknown;

export interface MetadataConfig {
  readonly id?: string;
  readonly tenantId: string;
  readonly configKey: string;
  readonly configValues: Record<string, unknown>;
  readonly version: number;
  readonly updatedAt?: Date;
  readonly updatedBy?: string;
  readonly correlationId?: string;
}

export class MetadataEngine {
  private static instance: MetadataEngine;

  private constructor() {}

  public static getInstance(): MetadataEngine {
    if (!MetadataEngine.instance) {
      MetadataEngine.instance = new MetadataEngine();
    }
    return MetadataEngine.instance;
  }

  /**
   * Fetch the latest version of a metadata config by key for a tenant
   */
  public async getLatest(tenantId: string, configKey: string): Promise<MetadataConfig | null> {
    const { data, error } = await supabase
      .from('metadata_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('config_key', configKey)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[MetadataEngine Error] Failed to get latest metadata:', error.message);
      throw error; // Rule #1: Zero Silent Database Failures
    }

    if (!data) return null;

    return {
      id: data.id,
      tenantId: data.tenant_id,
      configKey: data.config_key,
      configValues: data.config_values,
      version: data.version,
      updatedAt: new Date(data.updated_at),
      updatedBy: data.updated_by,
      correlationId: data.correlation_id,
    };
  }

  /**
   * Fetch a specific version of a metadata config by key for a tenant
   */
  public async getVersion(
    tenantId: string,
    configKey: string,
    version: number
  ): Promise<MetadataConfig | null> {
    const { data, error } = await supabase
      .from('metadata_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('config_key', configKey)
      .eq('version', version)
      .maybeSingle();

    if (error) {
      console.error('[MetadataEngine Error] Failed to get version metadata:', error.message);
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      tenantId: data.tenant_id,
      configKey: data.config_key,
      configValues: data.config_values,
      version: data.version,
      updatedAt: new Date(data.updated_at),
      updatedBy: data.updated_by,
      correlationId: data.correlation_id,
    };
  }

  /**
   * Save a new version of metadata config. Automatically increments version number.
   * Logs a snapshot entry in history table.
   */
  public async saveNewVersion(params: {
    tenantId: string;
    configKey: string;
    configValues: Record<string, unknown>;
    updatedBy?: string;
    correlationId?: string;
  }): Promise<MetadataConfig> {
    const latest = await this.getLatest(params.tenantId, params.configKey);
    const nextVersion = latest ? latest.version + 1 : 1;

    // 1. Insert into metadata_configs
    const configPayload = {
      tenant_id: params.tenantId,
      config_key: params.configKey,
      config_values: params.configValues,
      version: nextVersion,
      updated_by: params.updatedBy || 'system',
      correlation_id: params.correlationId,
      updated_at: new Date().toISOString(),
    };

    const { data: configData, error: configError } = await supabase
      .from('metadata_configs')
      .insert(configPayload)
      .select('*')
      .single();

    if (configError) {
      console.error('[MetadataEngine Error] Failed to insert config version:', configError.message);
      throw configError;
    }

    // 2. Insert snapshot to history table
    const historyPayload = {
      config_id: configData.id,
      tenant_id: params.tenantId,
      config_key: params.configKey,
      config_values: params.configValues,
      version: nextVersion,
      changed_by: params.updatedBy || 'system',
      correlation_id: params.correlationId,
      changed_at: configData.updated_at,
    };

    const { error: historyError } = await supabase
      .from('metadata_config_history')
      .insert(historyPayload);

    if (historyError) {
      console.error('[MetadataEngine Error] Failed to insert config history:', historyError.message);
      throw historyError;
    }

    return {
      id: configData.id,
      tenantId: configData.tenant_id,
      configKey: configData.config_key,
      configValues: configData.config_values,
      version: configData.version,
      updatedAt: new Date(configData.updated_at),
      updatedBy: configData.updated_by,
      correlationId: configData.correlation_id,
    };
  }
}

export const metadataEngine = MetadataEngine.getInstance();
