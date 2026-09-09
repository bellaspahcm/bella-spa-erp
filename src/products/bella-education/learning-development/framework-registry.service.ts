import { SupabaseClient } from "@supabase/supabase-js";

export type FrameworkVersionStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface IFramework {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface IFrameworkVersion {
  id: string;
  tenant_id: string;
  framework_id: string;
  version: string;
  status: FrameworkVersionStatus;
  checksum?: string;
  created_at: string;
}

export interface IFrameworkDomain {
  id: string;
  tenant_id: string;
  framework_version_id: string;
  code: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface IMilestone {
  id: string;
  tenant_id: string;
  framework_version_id: string;
  framework_domain_id: string;
  min_age_months?: number;
  max_age_months?: number;
  code: string;
  title: string;
  description?: string;
  indicator_statement: string;
  created_at: string;
}

export interface ICreateFrameworkDto {
  tenantId: string;
  code: string;
  name: string;
  description?: string;
}

export interface ICreateVersionDto {
  tenantId: string;
  frameworkId: string;
  version: string;
}

export interface ICreateFrameworkDomainDto {
  tenantId: string;
  frameworkVersionId: string;
  code: string;
  name: string;
  description?: string;
}

export interface ICreateMilestoneDto {
  tenantId: string;
  frameworkVersionId: string;
  frameworkDomainId: string;
  minAgeMonths?: number;
  maxAgeMonths?: number;
  code: string;
  title: string;
  description?: string;
  indicatorStatement: string;
}

export class FrameworkRegistryService {
  constructor(private readonly supabase: SupabaseClient) {}

  async createFramework(dto: ICreateFrameworkDto): Promise<IFramework> {
    const { data, error } = await this.supabase
      .from("edu_dev_frameworks")
      .insert({
        tenant_id: dto.tenantId,
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`FRAMEWORK_CREATE_FAILED: ${error?.message || "Failed to create framework"}`);
    }

    return data as IFramework;
  }

  async createVersion(dto: ICreateVersionDto): Promise<IFrameworkVersion> {
    const { data, error } = await this.supabase
      .from("edu_dev_framework_versions")
      .insert({
        tenant_id: dto.tenantId,
        framework_id: dto.frameworkId,
        version: dto.version,
        status: "DRAFT",
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`FRAMEWORK_VERSION_CREATE_FAILED: ${error?.message || "Failed to create version"}`);
    }

    return data as IFrameworkVersion;
  }

  async createDomain(dto: ICreateFrameworkDomainDto): Promise<IFrameworkDomain> {
    const { data, error } = await this.supabase
      .from("edu_dev_framework_domains")
      .insert({
        tenant_id: dto.tenantId,
        framework_version_id: dto.frameworkVersionId,
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`FRAMEWORK_DOMAIN_CREATE_FAILED: ${error?.message || "Failed to create framework domain"}`);
    }

    return data as IFrameworkDomain;
  }

  async createMilestone(dto: ICreateMilestoneDto): Promise<IMilestone> {
    const { data, error } = await this.supabase
      .from("edu_dev_milestones")
      .insert({
        tenant_id: dto.tenantId,
        framework_version_id: dto.frameworkVersionId,
        framework_domain_id: dto.frameworkDomainId,
        min_age_months: dto.minAgeMonths ?? null,
        max_age_months: dto.maxAgeMonths ?? null,
        code: dto.code,
        title: dto.title,
        description: dto.description ?? null,
        indicator_statement: dto.indicatorStatement,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`MILESTONE_CREATE_FAILED: ${error?.message || "Failed to create milestone"}`);
    }

    return data as IMilestone;
  }

  async activateVersion(tenantId: string, versionId: string, checksum?: string): Promise<IFrameworkVersion> {
    const { data, error } = await this.supabase
      .from("edu_dev_framework_versions")
      .update({
        status: "ACTIVE",
        checksum: checksum ?? "sha256-verified-active",
      })
      .eq("id", versionId)
      .eq("tenant_id", tenantId)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`FRAMEWORK_VERSION_ACTIVATE_FAILED: ${error?.message || "Failed to activate version"}`);
    }

    return data as IFrameworkVersion;
  }

  async getActiveMilestones(tenantId: string, frameworkVersionId: string): Promise<IMilestone[]> {
    const { data, error } = await this.supabase
      .from("edu_dev_milestones")
      .select("*")
      .eq("framework_version_id", frameworkVersionId)
      .eq("tenant_id", tenantId);

    if (error) {
      throw new Error(`FETCH_MILESTONES_FAILED: ${error.message}`);
    }

    return (data || []) as IMilestone[];
  }
}
