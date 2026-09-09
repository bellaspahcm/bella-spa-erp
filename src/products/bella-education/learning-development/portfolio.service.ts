import { SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

export type PortfolioVersionStatus = "DRAFT" | "READY_TO_PUBLISH" | "PUBLISHED";
export type PortfolioItemType = "OBSERVATION" | "EVIDENCE" | "MILESTONE_PROGRESS" | "NEXT_STEP";

export interface IPortfolio {
  id: string;
  tenant_id: string;
  student_id: string;
  title: string;
  description?: string;
  created_at: string;
}

export interface IPortfolioVersion {
  id: string;
  tenant_id: string;
  portfolio_id: string;
  version_number: number;
  period_label: string;
  status: PortfolioVersionStatus;
  compiled_by: string;
  compiled_at: string;
  created_at: string;
}

export interface IPortfolioItem {
  id: string;
  tenant_id: string;
  portfolio_version_id: string;
  item_type: PortfolioItemType;
  reference_id: string;
  teacher_comment?: string;
  display_order: number;
  created_at: string;
}

export interface IPortfolioPublication {
  id: string;
  tenant_id: string;
  portfolio_version_id: string;
  publisher_id: string;
  published_at: string;
  publication_checksum: string;
  created_at: string;
}

export interface ICompilePortfolioVersionDto {
  tenantId: string;
  studentId: string;
  periodLabel: string;
  compiledBy: string;
  items: Array<{
    itemType: PortfolioItemType;
    referenceId: string;
    teacherComment?: string;
    displayOrder?: number;
  }>;
}

export class PortfolioService {
  constructor(private readonly supabase: SupabaseClient) {}

  async getOrCreatePortfolio(tenantId: string, studentId: string, title?: string): Promise<IPortfolio> {
    const { data: existing } = await this.supabase
      .from("edu_dev_portfolios")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .single();

    if (existing) {
      return existing as IPortfolio;
    }

    const { data: created, error } = await this.supabase
      .from("edu_dev_portfolios")
      .insert({
        tenant_id: tenantId,
        student_id: studentId,
        title: title ?? "Developmental Portfolio",
      })
      .select("*")
      .single();

    if (error || !created) {
      throw new Error(`PORTFOLIO_CREATE_FAILED: ${error?.message || "Failed to create portfolio"}`);
    }

    return created as IPortfolio;
  }

  async compilePortfolioVersion(dto: ICompilePortfolioVersionDto): Promise<{
    version: IPortfolioVersion;
    items: IPortfolioItem[];
  }> {
    const portfolio = await this.getOrCreatePortfolio(dto.tenantId, dto.studentId);

    // Get current max version_number
    const { data: latestVersion } = await this.supabase
      .from("edu_dev_portfolio_versions")
      .select("version_number")
      .eq("portfolio_id", portfolio.id)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    const nextVersionNumber = (latestVersion?.version_number || 0) + 1;

    // 1. Create version record (DRAFT)
    const { data: ver, error: verErr } = await this.supabase
      .from("edu_dev_portfolio_versions")
      .insert({
        tenant_id: dto.tenantId,
        portfolio_id: portfolio.id,
        version_number: nextVersionNumber,
        period_label: dto.periodLabel,
        status: "DRAFT",
        compiled_by: dto.compiledBy,
      })
      .select("*")
      .single();

    if (verErr || !ver) {
      throw new Error(`PORTFOLIO_VERSION_CREATE_FAILED: ${verErr?.message}`);
    }

    const version = ver as IPortfolioVersion;
    const createdItems: IPortfolioItem[] = [];

    // 2. Validate & attach items
    for (let i = 0; i < dto.items.length; i++) {
      const item = dto.items[i];

      // Privacy & Consent Guard for EVIDENCE items
      if (item.itemType === "EVIDENCE") {
        const { data: ev, error: evErr } = await this.supabase
          .from("edu_dev_evidence")
          .select("*")
          .eq("id", item.referenceId)
          .eq("tenant_id", dto.tenantId)
          .single();

        if (evErr || !ev) {
          throw new Error(`PORTFOLIO_EVIDENCE_NOT_FOUND: Evidence item ${item.referenceId} not found.`);
        }

        // Privacy Check: INTERNAL_TEACHER evidence is strictly forbidden in portfolios
        if (ev.visibility === "INTERNAL_TEACHER") {
          throw new Error("PORTFOLIO_PRIVACY_VIOLATION_ERROR: Cannot include INTERNAL_TEACHER evidence in portfolio.");
        }

        // Consent Check: OPT_OUT or RESTRICTED_INTERNAL consent is strictly forbidden
        if (ev.consent_scope === "OPT_OUT" || ev.consent_scope === "RESTRICTED_INTERNAL") {
          throw new Error("PORTFOLIO_CONSENT_VIOLATION_ERROR: Cannot include evidence with invalid/opt-out consent scope.");
        }
      }

      const { data: pit, error: pitErr } = await this.supabase
        .from("edu_dev_portfolio_items")
        .insert({
          tenant_id: dto.tenantId,
          portfolio_version_id: version.id,
          item_type: item.itemType,
          reference_id: item.referenceId,
          teacher_comment: item.teacherComment ?? null,
          display_order: item.displayOrder ?? i + 1,
        })
        .select("*")
        .single();

      if (pitErr || !pit) {
        throw new Error(`PORTFOLIO_ITEM_ATTACH_FAILED: ${pitErr?.message}`);
      }

      createdItems.push(pit as IPortfolioItem);
    }

    return { version, items: createdItems };
  }

  async publishPortfolioVersion(tenantId: string, versionId: string, publisherId: string): Promise<IPortfolioPublication> {
    // 1. Fetch version & items
    const { data: version, error: vErr } = await this.supabase
      .from("edu_dev_portfolio_versions")
      .select(`
        *,
        items:edu_dev_portfolio_items (*)
      `)
      .eq("id", versionId)
      .eq("tenant_id", tenantId)
      .single();

    if (vErr || !version) {
      throw new Error("PORTFOLIO_VERSION_NOT_FOUND: Portfolio version not found.");
    }

    if (version.status === "PUBLISHED") {
      throw new Error("PORTFOLIO_ALREADY_PUBLISHED_ERROR: Cannot re-publish an already published version.");
    }

    // 2. Re-verify Privacy & Consent Guards before final publication
    for (const item of version.items) {
      if (item.item_type === "EVIDENCE") {
        const { data: ev } = await this.supabase
          .from("edu_dev_evidence")
          .select("*")
          .eq("id", item.reference_id)
          .single();

        if (!ev || ev.visibility === "INTERNAL_TEACHER") {
          throw new Error("PORTFOLIO_PRIVACY_VIOLATION_ERROR: Cannot publish evidence marked INTERNAL_TEACHER.");
        }

        if (ev.consent_scope === "OPT_OUT" || ev.consent_scope === "RESTRICTED_INTERNAL") {
          throw new Error("PORTFOLIO_CONSENT_VIOLATION_ERROR: Cannot publish evidence with invalid/opt-out consent.");
        }
      }
    }

    // 3. Update status to PUBLISHED
    const { error: upErr } = await this.supabase
      .from("edu_dev_portfolio_versions")
      .update({ status: "PUBLISHED" })
      .eq("id", versionId)
      .eq("tenant_id", tenantId);

    if (upErr) {
      throw new Error(`PORTFOLIO_PUBLISH_FAILED: ${upErr.message}`);
    }

    // 4. Generate SHA-256 checksum snapshot
    const payloadToHash = JSON.stringify({
      versionId: version.id,
      portfolioId: version.portfolio_id,
      versionNumber: version.version_number,
      itemsCount: version.items.length,
      publishedAt: new Date().toISOString(),
    });
    const checksum = crypto.createHash("sha256").update(payloadToHash).digest("hex");

    // 5. Insert publication record
    const { data: pub, error: pubErr } = await this.supabase
      .from("edu_dev_portfolio_publications")
      .insert({
        tenant_id: tenantId,
        portfolio_version_id: versionId,
        publisher_id: publisherId,
        publication_checksum: checksum,
      })
      .select("*")
      .single();

    if (pubErr || !pub) {
      throw new Error(`PORTFOLIO_PUBLICATION_RECORD_FAILED: ${pubErr?.message}`);
    }

    return pub as IPortfolioPublication;
  }

  async getParentPortfolioProjection(tenantId: string, studentId: string): Promise<{
    portfolio: IPortfolio;
    publishedVersion: IPortfolioVersion;
    publication: IPortfolioPublication;
    allowedItems: Array<{
      itemType: PortfolioItemType;
      referenceId: string;
      teacherComment?: string;
      content: unknown;
    }>;
  }> {
    // 1. Fetch student portfolio
    const { data: portfolio, error: pErr } = await this.supabase
      .from("edu_dev_portfolios")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .single();

    if (pErr || !portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND: No portfolio found for this student.");
    }

    // 2. Fetch latest published version
    const { data: version, error: vErr } = await this.supabase
      .from("edu_dev_portfolio_versions")
      .select(`
        *,
        items:edu_dev_portfolio_items (*)
      `)
      .eq("portfolio_id", portfolio.id)
      .eq("status", "PUBLISHED")
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    if (vErr || !version) {
      throw new Error("PORTFOLIO_NO_PUBLISHED_VERSION_ERROR: Student has no published portfolio versions yet.");
    }

    // 3. Fetch publication metadata
    const { data: publication } = await this.supabase
      .from("edu_dev_portfolio_publications")
      .select("*")
      .eq("portfolio_version_id", version.id)
      .single();

    // 4. Build parent read projection (filtering out INTERNAL_TEACHER content)
    const allowedItems: Array<{
      itemType: PortfolioItemType;
      referenceId: string;
      teacherComment?: string;
      content: unknown;
    }> = [];

    for (const item of version.items as IPortfolioItem[]) {
      if (item.item_type === "EVIDENCE") {
        const { data: ev } = await this.supabase.from("edu_dev_evidence").select("*").eq("id", item.reference_id).single();
        if (ev && (ev.visibility === "PARENT_SHARED" || ev.visibility === "PORTFOLIO_PUBLISHED")) {
          allowedItems.push({
            itemType: item.item_type,
            referenceId: item.reference_id,
            teacherComment: item.teacher_comment,
            content: ev,
          });
        }
      } else if (item.item_type === "MILESTONE_PROGRESS") {
        const { data: prog } = await this.supabase.from("edu_dev_milestone_progress").select("*").eq("id", item.reference_id).single();
        if (prog && prog.is_confirmed) {
          allowedItems.push({
            itemType: item.item_type,
            referenceId: item.reference_id,
            teacherComment: item.teacher_comment,
            content: prog,
          });
        }
      } else if (item.item_type === "NEXT_STEP") {
        const { data: ns } = await this.supabase.from("edu_dev_next_steps").select("*").eq("id", item.reference_id).single();
        if (ns && ns.status === "ACTIVE") {
          allowedItems.push({
            itemType: item.item_type,
            referenceId: item.reference_id,
            teacherComment: item.teacher_comment,
            content: ns,
          });
        }
      } else if (item.item_type === "OBSERVATION") {
        const { data: obs } = await this.supabase.from("edu_dev_observations").select("*").eq("id", item.reference_id).single();
        if (obs && obs.status === "RECORDED") {
          allowedItems.push({
            itemType: item.item_type,
            referenceId: item.reference_id,
            teacherComment: item.teacher_comment,
            content: { id: obs.id, observation_text: obs.observation_text, created_at: obs.created_at },
          });
        }
      }
    }

    return {
      portfolio: portfolio as IPortfolio,
      publishedVersion: version as IPortfolioVersion,
      publication: publication as IPortfolioPublication,
      allowedItems,
    };
  }
}
