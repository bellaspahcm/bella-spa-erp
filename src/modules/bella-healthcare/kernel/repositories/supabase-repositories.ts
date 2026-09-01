import { createClient as createBrowserClient } from '@/lib/supabase-client';
import type { Database, Json } from '@/types/database.types';

async function createClient() {
  if (typeof window !== 'undefined') {
    return createBrowserClient();
  }
  const { createClient: createServerClient } = await import(/* webpackIgnore: true */ '../../../../lib/supabase-server');
  return createServerClient();
}
// Database type imported but not used in implementation (repositories use runtime queries)
import type {
  IPartyRepository,
  Party,
  CreatePartyInput,
  AddRoleInput,
  AddRelationshipInput,
  PartySearchFilter,
  IdentifierType,
} from '@/platform/party';
import type {
  IJourneyRepository,
  Journey,
  SubJourney,
  JourneyMilestone,
  CreateJourneyInput,
  JourneyFilter,
  UpdateMilestoneInput,
  JourneyStatus,
} from '@/platform/journey';
import type {
  ITimelineRepository,
  TimelineEvent,
  AppendEventInput,
  TimelineFilter,
  TimelineEventCategory,
} from '@/platform/timeline';
import type {
  IKnowledgeRepository,
  KnowledgeEntry,
  KnowledgeDomain,
  KnowledgeGraphEdge,
  InferenceRule,
  InferenceCheckResult,
  PromptTemplate,
  OntologyTerm,
  KnowledgeSearchResult,
} from '@/platform/knowledge';
import type {
  IAssetRepository,
  Asset,
  CreateAssetInput,
  UpdateAssetStatusInput,
  AssetFilter,
} from '@/platform/asset';
import type {
  IContractRepository,
  Contract,
  CreateContractInput,
  ContractFilter,
  ContractStatus,
  ContractParty,
  ContractLineItem,
  PaymentSchedule,
} from '@/platform/contract';

type Tables = Database['public']['Tables'];
type PartyUpdate = Tables['party_parties']['Update'];
type PartyRoleRow = Tables['party_roles']['Row'];
type PartyRelationshipRow = Tables['party_relationships']['Row'];
type JourneyRow = Tables['journey_journeys']['Row'];
type JourneySubJourneyRow = Tables['journey_sub_journeys']['Row'];
type JourneyMilestoneRow = Tables['journey_milestones']['Row'];
type TimelineEventRow = Tables['timeline_events']['Row'];
type AssetRow = Tables['asset_assets']['Row'];
type ContractRow = Tables['contract_contracts']['Row'];
type KnowledgeEntryRow = Tables['knowledge_entries']['Row'];
type KnowledgeGraphEdgeRow = Tables['knowledge_graph_edges']['Row'];
type InferenceRuleRow = Tables['knowledge_inference_rules']['Row'];

type JourneyWithChildren = JourneyRow & {
  journey_sub_journeys?: Array<JourneySubJourneyRow & {
    journey_milestones?: JourneyMilestoneRow[];
  }>;
};

// Helper to convert DB date/string types to Date object
const toDate = (d: string | null | undefined): Date | undefined => (d ? new Date(d) : undefined);
const toRequiredDate = (d: string): Date => new Date(d);
const toJson = (value: unknown): Json => value as Json;

function toRecord(value: Json | null | undefined): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function toArray(value: Json | null | undefined): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toContractParties(value: Json | null | undefined): ContractParty[] {
  return toArray(value).filter((item): item is ContractParty => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const row = item as Record<string, unknown>;
    return typeof row.partyId === 'string'
      && (row.role === 'provider' || row.role === 'client' || row.role === 'guarantor' || row.role === 'insurer');
  });
}

function toContractLineItems(value: Json | null | undefined): ContractLineItem[] {
  return toArray(value).filter((item): item is ContractLineItem => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const row = item as Record<string, unknown>;
    return typeof row.code === 'string'
      && typeof row.description === 'string'
      && typeof row.quantity === 'number'
      && typeof row.unitPrice === 'number'
      && typeof row.subtotal === 'number';
  });
}

function toPaymentSchedule(value: Json | null | undefined): PaymentSchedule | undefined {
  const row = toRecord(value);
  const frequency = row.frequency;
  if (
    frequency !== 'one_time'
    && frequency !== 'weekly'
    && frequency !== 'monthly'
    && frequency !== 'quarterly'
    && frequency !== 'annually'
  ) {
    return undefined;
  }

  return {
    frequency,
    installments: typeof row.installments === 'number' ? row.installments : undefined,
    amountPerInstallment: typeof row.amountPerInstallment === 'number' ? row.amountPerInstallment : undefined,
    dueDay: typeof row.dueDay === 'number' ? row.dueDay : undefined,
    nextDueDate: typeof row.nextDueDate === 'string' ? new Date(row.nextDueDate) : undefined,
  };
}

function toTimelineCategory(value: string): TimelineEventCategory {
  return value === 'audit' || value === 'ai' || value === 'system' ? value : 'business';
}

function toInferenceConditions(value: Json | null | undefined): InferenceRule['conditions'] {
  return toArray(value).filter((item): item is InferenceRule['conditions'][number] => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const row = item as Record<string, unknown>;
    return typeof row.field === 'string'
      && (row.operator === 'eq'
        || row.operator === 'neq'
        || row.operator === 'gt'
        || row.operator === 'lt'
        || row.operator === 'contains'
        || row.operator === 'in'
        || row.operator === 'not_in');
  });
}

function toInferenceAction(value: Json | null | undefined): InferenceRule['action'] {
  const row = toRecord(value);
  const type = row.type;
  return {
    type: type === 'block' || type === 'warn' || type === 'require' || type === 'suggest' || type === 'calculate'
      ? type
      : 'warn',
    payload: toRecord(toJson(row.payload)),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. SUPABASE PARTY REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════

export class SupabasePartyRepository implements IPartyRepository {
  async create(tenantId: string, input: CreatePartyInput, actorId: string): Promise<Party> {
    const supabase = await createClient();

    // 1. Insert Party Parties
    const { data: partyData, error: partyError } = await supabase
      .from('party_parties')
      .insert({
        tenant_id: tenantId,
        party_type: input.partyType,
        display_name: input.displayName,
        legal_name: input.legalName,
        tax_code: input.taxCode,
        dob: input.dob ? input.dob.toISOString().split('T')[0] : null,
        gender: input.gender,
        blood_type: input.bloodType,
        created_by: actorId,
        updated_by: actorId,
      })
      .select()
      .single();

    if (partyError || !partyData) throw partyError || new Error('Failed to create party');

    // 2. Insert initial role if specified
    if (input.initialRole) {
      const { error: roleError } = await supabase
        .from('party_roles')
        .insert({
          tenant_id: tenantId,
          party_id: partyData.id,
          vertical: input.initialRole.vertical,
          role_type: input.initialRole.roleType,
          attributes: toJson(input.initialRole.attributes ?? {}),
          active_from: input.initialRole.activeFrom ? input.initialRole.activeFrom.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          active_to: input.initialRole.activeTo ? input.initialRole.activeTo.toISOString().split('T')[0] : null,
        });

      if (roleError) throw roleError;
    }

    // 3. Insert initial identifiers if specified
    if (input.initialIdentifiers && input.initialIdentifiers.length > 0) {
      const { error: idError } = await supabase
        .from('party_identifiers')
        .insert(
          input.initialIdentifiers.map((id) => ({
            tenant_id: tenantId,
            party_id: partyData.id,
            identifier_type: id.type,
            identifier_value: id.value,
            issued_at: id.issuedAt ? id.issuedAt.toISOString().split('T')[0] : null,
            expires_at: id.expiresAt ? id.expiresAt.toISOString().split('T')[0] : null,
          }))
        );

      if (idError) throw idError;
    }

    const fullParty = await this.findById(tenantId, partyData.id);
    if (!fullParty) throw new Error('Party created but could not be retrieved');
    return fullParty;
  }

  async findById(tenantId: string, id: string): Promise<Party | null> {
    const supabase = await createClient();

    const { data: party, error } = await supabase
      .from('party_parties')
      .select(`
        *,
        party_identifiers(*),
        party_roles(*),
        party_relationships:party_relationships!party_relationships_source_party_id_fkey(*)
      `)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();

    if (error || !party) return null;

    return {
      id: party.id,
      tenantId: party.tenant_id,
      partyType: party.party_type as 'person' | 'organization',
      displayName: party.display_name,
      legalName: party.legal_name || undefined,
      taxCode: party.tax_code || undefined,
      dob: toDate(party.dob),
      gender: (party.gender as 'male' | 'female' | 'other') || undefined,
      bloodType: party.blood_type || undefined,
      identifiers: (party.party_identifiers || []).map((i: { identifier_type: string; identifier_value: string; issued_at: string | null; expires_at: string | null }) => ({
        type: i.identifier_type as IdentifierType,
        value: i.identifier_value,
        issuedAt: toDate(i.issued_at),
        expiresAt: toDate(i.expires_at),
      })),
      roles: (party.party_roles || []).map((r: PartyRoleRow) => ({
        vertical: r.vertical,
        roleType: r.role_type,
        attributes: toRecord(r.attributes),
        activeFrom: toDate(r.active_from),
        activeTo: toDate(r.active_to),
      })),
      relationships: (party.party_relationships || []).map((rel: PartyRelationshipRow) => ({
        targetPartyId: rel.target_party_id,
        type: rel.relationship_type,
        attributes: toRecord(rel.attributes),
        activeFrom: toDate(rel.active_from),
        activeTo: toDate(rel.active_to),
      })),
      version: party.version,
      createdAt: toRequiredDate(party.created_at),
      updatedAt: toRequiredDate(party.updated_at),
      deletedAt: toDate(party.deleted_at),
      createdBy: party.created_by || undefined,
      updatedBy: party.updated_by || undefined,
    };
  }

  async findByIdentifier(tenantId: string, type: IdentifierType, value: string): Promise<Party | null> {
    const supabase = await createClient();

    const { data: identifier, error } = await supabase
      .from('party_identifiers')
      .select('party_id')
      .eq('tenant_id', tenantId)
      .eq('identifier_type', type)
      .eq('identifier_value', value)
      .single();

    if (error || !identifier) return null;

    return this.findById(tenantId, identifier.party_id);
  }

  async search(tenantId: string, filter: PartySearchFilter): Promise<Party[]> {
    const supabase = await createClient();

    let query = supabase
      .from('party_parties')
      .select('id')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (filter.partyType) {
      query = query.eq('party_type', filter.partyType);
    }
    if (filter.displayNameLike) {
      query = query.ilike('display_name', `%${filter.displayNameLike}%`);
    }

    const { data, error } = await query.limit(filter.limit || 50).range(filter.offset || 0, (filter.offset || 0) + (filter.limit || 50) - 1);
    if (error || !data) return [];

    const list: Party[] = [];
    for (const p of data) {
      const full = await this.findById(tenantId, p.id);
      if (full) list.push(full);
    }
    return list;
  }

  async addRole(tenantId: string, input: AddRoleInput, _actorId: string): Promise<Party> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('party_roles')
      .insert({
        tenant_id: tenantId,
        party_id: input.partyId,
        vertical: input.vertical,
        role_type: input.roleType,
        attributes: toJson(input.attributes ?? {}),
        active_from: input.activeFrom ? input.activeFrom.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        active_to: input.activeTo ? input.activeTo.toISOString().split('T')[0] : null,
      });

    if (error) throw error;

    const full = await this.findById(tenantId, input.partyId);
    if (!full) throw new Error('Party not found after role insertion');
    return full;
  }

  async addRelationship(tenantId: string, input: AddRelationshipInput, _actorId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('party_relationships')
      .insert({
        tenant_id: tenantId,
        source_party_id: input.sourcePartyId,
        target_party_id: input.targetPartyId,
        relationship_type: input.type,
        attributes: toJson(input.attributes ?? {}),
      });

    if (error) throw error;
  }

  async update(tenantId: string, partyId: string, patch: Partial<CreatePartyInput>, expectedVersion: number, actorId: string): Promise<Party> {
    const supabase = await createClient();

    const updateObj: PartyUpdate = {
      version: expectedVersion + 1,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    };

    if (patch.displayName !== undefined) updateObj.display_name = patch.displayName;
    if (patch.legalName !== undefined) updateObj.legal_name = patch.legalName;
    if (patch.taxCode !== undefined) updateObj.tax_code = patch.taxCode;
    if (patch.dob !== undefined) updateObj.dob = patch.dob ? patch.dob.toISOString().split('T')[0] : null;
    if (patch.gender !== undefined) updateObj.gender = patch.gender;
    if (patch.bloodType !== undefined) updateObj.blood_type = patch.bloodType;

    const { data, error } = await supabase
      .from('party_parties')
      .update(updateObj)
      .eq('tenant_id', tenantId)
      .eq('id', partyId)
      .eq('version', expectedVersion)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Optimistic locking error: Version mismatch or party not found');

    const full = await this.findById(tenantId, partyId);
    if (!full) throw new Error('Party not found after update');
    return full;
  }

  async softDelete(tenantId: string, partyId: string, actorId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('party_parties')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: actorId,
      })
      .eq('tenant_id', tenantId)
      .eq('id', partyId);

    if (error) throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. SUPABASE JOURNEY REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════

export class SupabaseJourneyRepository implements IJourneyRepository {
  async create(tenantId: string, input: CreateJourneyInput, _actorId: string): Promise<Journey> {
    const supabase = await createClient();

    // 1. Insert Journey
    const { data: jData, error: jError } = await supabase
      .from('journey_journeys')
      .insert({
        tenant_id: tenantId,
        vertical: input.vertical,
        journey_type: input.journeyType,
        primary_party_id: input.primaryPartyId,
        status: 'active',
        metadata: toJson(input.metadata ?? {}),
      })
      .select()
      .single();

    if (jError || !jData) throw jError || new Error('Failed to create journey');

    // 2. Insert initial sub journeys and milestones if specified
    if (input.initialSubJourneys && input.initialSubJourneys.length > 0) {
      for (const sj of input.initialSubJourneys) {
        const { data: sjData, error: sjError } = await supabase
          .from('journey_sub_journeys')
          .insert({
            tenant_id: tenantId,
            journey_id: jData.id,
            name: sj.name,
            status: 'pending',
          })
          .select()
          .single();

        if (sjError || !sjData) throw sjError || new Error('Failed to create sub journey');

        if (sj.milestones && sj.milestones.length > 0) {
          const { error: msError } = await supabase
            .from('journey_milestones')
            .insert(
              sj.milestones.map((ms) => ({
                tenant_id: tenantId,
                journey_id: jData.id,
                sub_journey_id: sjData.id,
                name: ms.name,
                status: 'pending',
                target_date: ms.targetDate ? ms.targetDate.toISOString().split('T')[0] : null,
              }))
            );

          if (msError) throw msError;
        }
      }
    }

    const full = await this.findById(tenantId, jData.id);
    if (!full) throw new Error('Journey created but retrieval failed');
    return full;
  }

  async findById(tenantId: string, id: string): Promise<Journey | null> {
    const supabase = await createClient();

    const { data: journey, error } = await supabase
      .from('journey_journeys')
      .select(`
        *,
        journey_sub_journeys(
          *,
          journey_milestones(*)
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();

    if (error || !journey) return null;

    return {
      id: journey.id,
      tenantId: journey.tenant_id,
      vertical: journey.vertical,
      journeyType: journey.journey_type,
      primaryPartyId: journey.primary_party_id,
      status: journey.status as JourneyStatus,
      startedAt: toRequiredDate(journey.started_at),
      expectedEndAt: undefined,
      completedAt: toDate(journey.completed_at),
      aiSummary: journey.ai_summary || undefined,
      metadata: toRecord(journey.metadata),
      subJourneys: (journey.journey_sub_journeys || []).map((sj) => ({
        id: sj.id,
        journeyId: sj.journey_id,
        tenantId: sj.tenant_id,
        name: sj.name,
        description: undefined,
        status: sj.status as 'pending' | 'active' | 'completed' | 'cancelled',
        startedAt: toDate(sj.started_at),
        completedAt: toDate(sj.completed_at),
        milestones: (sj.journey_milestones || []).map((ms) => ({
          id: ms.id,
          journeyId: ms.journey_id,
          subJourneyId: ms.sub_journey_id || undefined,
          name: ms.name,
          description: undefined,
          status: ms.status as 'pending' | 'in_progress' | 'completed' | 'skipped',
          targetDate: toDate(ms.target_date),
          completedAt: toDate(ms.completed_at),
          aiValidationDetails: toRecord(ms.ai_validation_details),
          createdAt: toRequiredDate(ms.created_at),
        })),
        version: sj.version,
        createdAt: toRequiredDate(sj.created_at),
      })),
      version: journey.version,
      createdAt: toRequiredDate(journey.created_at),
      updatedAt: undefined,
      deletedAt: toDate(journey.deleted_at),
    };
  }

  async findMany(tenantId: string, filter?: JourneyFilter): Promise<Journey[]> {
    const supabase = await createClient();

    let query = supabase
      .from('journey_journeys')
      .select('id')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (filter) {
      if (filter.vertical) query = query.eq('vertical', filter.vertical);
      if (filter.journeyType) query = query.eq('journey_type', filter.journeyType);
      if (filter.primaryPartyId) query = query.eq('primary_party_id', filter.primaryPartyId);
      if (filter.status) query = query.eq('status', filter.status);
    }

    const { data, error } = await query
      .limit(filter?.limit || 50)
      .range(filter?.offset || 0, (filter?.offset || 0) + (filter?.limit || 50) - 1);

    if (error || !data) return [];

    const list: Journey[] = [];
    for (const j of data) {
      const full = await this.findById(tenantId, j.id);
      if (full) list.push(full);
    }
    return list;
  }

  async updateStatus(tenantId: string, journeyId: string, status: JourneyStatus, expectedVersion: number, _actorId: string): Promise<Journey> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('journey_journeys')
      .update({
        status,
        version: expectedVersion + 1,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
      })
      .eq('tenant_id', tenantId)
      .eq('id', journeyId)
      .eq('version', expectedVersion)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Optimistic lock check failed');

    const full = await this.findById(tenantId, journeyId);
    if (!full) throw new Error('Journey not found');
    return full;
  }

  async addSubJourney(tenantId: string, journeyId: string, name: string, description?: string): Promise<SubJourney> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('journey_sub_journeys')
      .insert({
        tenant_id: tenantId,
        journey_id: journeyId,
        name,
        status: 'pending',
      })
      .select()
      .single();

    if (error || !data) throw error || new Error('Failed to create sub journey');

    return {
      id: data.id,
      journeyId: data.journey_id,
      tenantId: data.tenant_id,
      name: data.name,
      description: description || undefined,
      status: 'pending',
      milestones: [],
      version: data.version,
      createdAt: toRequiredDate(data.created_at),
    };
  }

  async activateSubJourney(tenantId: string, subJourneyId: string, _actorId: string): Promise<SubJourney> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('journey_sub_journeys')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', subJourneyId)
      .select()
      .single();

    if (error || !data) throw error || new Error('Failed to update subjourney');

    // Retrieve full subjourney
    const { data: milestones } = await supabase
      .from('journey_milestones')
      .select('*')
      .eq('sub_journey_id', subJourneyId);

    return {
      id: data.id,
      journeyId: data.journey_id,
      tenantId: data.tenant_id,
      name: data.name,
      description: undefined,
      status: 'active',
      startedAt: toDate(data.started_at),
      milestones: (milestones || []).map((m: JourneyMilestoneRow) => ({
        id: m.id,
        journeyId: m.journey_id,
        subJourneyId: m.sub_journey_id || undefined,
        name: m.name,
        description: undefined,
        status: m.status as 'pending' | 'in_progress' | 'completed' | 'skipped',
        targetDate: toDate(m.target_date),
        completedAt: toDate(m.completed_at),
        aiValidationDetails: toRecord(m.ai_validation_details),
        createdAt: toRequiredDate(m.created_at),
      })),
      version: data.version,
      createdAt: toRequiredDate(data.created_at),
    };
  }

  async completeSubJourney(tenantId: string, subJourneyId: string, _actorId: string): Promise<SubJourney> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('journey_sub_journeys')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', subJourneyId)
      .select()
      .single();

    if (error || !data) throw error || new Error('Failed to update subjourney');

    const { data: milestones } = await supabase
      .from('journey_milestones')
      .select('*')
      .eq('sub_journey_id', subJourneyId);

    return {
      id: data.id,
      journeyId: data.journey_id,
      tenantId: data.tenant_id,
      name: data.name,
      description: undefined,
      status: 'completed',
      startedAt: toDate(data.started_at),
      completedAt: toDate(data.completed_at),
      milestones: (milestones || []).map((m: JourneyMilestoneRow) => ({
        id: m.id,
        journeyId: m.journey_id,
        subJourneyId: m.sub_journey_id || undefined,
        name: m.name,
        description: undefined,
        status: m.status as 'pending' | 'in_progress' | 'completed' | 'skipped',
        targetDate: toDate(m.target_date),
        completedAt: toDate(m.completed_at),
        aiValidationDetails: toRecord(m.ai_validation_details),
        createdAt: toRequiredDate(m.created_at),
      })),
      version: data.version,
      createdAt: toRequiredDate(data.created_at),
    };
  }

  async updateMilestone(tenantId: string, input: UpdateMilestoneInput, _actorId: string): Promise<JourneyMilestone> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('journey_milestones')
      .update({
        status: input.status,
        completed_at: input.status === 'completed' ? new Date().toISOString() : null,
        ai_validation_details: toJson(input.aiValidationDetails ?? {}),
      })
      .eq('tenant_id', tenantId)
      .eq('id', input.milestoneId)
      .select()
      .single();

    if (error || !data) throw error || new Error('Failed to update milestone');

    return {
      id: data.id,
      journeyId: data.journey_id,
      subJourneyId: data.sub_journey_id || undefined,
      name: data.name,
      description: undefined,
      status: data.status as 'pending' | 'in_progress' | 'completed' | 'skipped',
      targetDate: toDate(data.target_date),
      completedAt: toDate(data.completed_at),
      aiValidationDetails: toRecord(data.ai_validation_details),
      createdAt: toRequiredDate(data.created_at),
    };
  }

  async updateAiSummary(tenantId: string, journeyId: string, summary: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('journey_journeys')
      .update({
        ai_summary: summary,
      })
      .eq('tenant_id', tenantId)
      .eq('id', journeyId);

    if (error) throw error;
  }

  async softDelete(tenantId: string, journeyId: string, _actorId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('journey_journeys')
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', journeyId);

    if (error) throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. SUPABASE TIMELINE REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════

export class SupabaseTimelineRepository implements ITimelineRepository {
  async append(input: AppendEventInput, sequenceNumber: number, eventHash: string): Promise<TimelineEvent> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('timeline_events')
      .insert({
        tenant_id: input.tenantId,
        vertical: input.vertical,
        primary_party_id: input.primaryPartyId,
        journey_id: input.journeyId || null,
        correlation_id: input.correlationId,
        causation_id: input.causationId || null,
        event_category: input.eventCategory,
        event_type: input.eventType,
        aggregate_id: input.aggregateId,
        aggregate_type: input.aggregateType,
        sequence_number: sequenceNumber,
        event_hash: eventHash,
        summary: input.summary,
        event_data: toJson(input.eventData),
        recorded_by: input.recordedBy || null,
        occurred_at: input.occurredAt ? input.occurredAt.toISOString() : new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !data) throw error || new Error('Failed to append timeline event');

    return {
      id: data.id,
      tenantId: data.tenant_id,
      vertical: data.vertical,
      primaryPartyId: data.primary_party_id,
      journeyId: data.journey_id || undefined,
      correlationId: data.correlation_id,
      causationId: data.causation_id || undefined,
      eventCategory: toTimelineCategory(data.event_category),
      eventType: data.event_type,
      eventVersion: data.event_version,
      schemaVersion: data.schema_version,
      aggregateId: data.aggregate_id,
      aggregateType: data.aggregate_type,
      sequenceNumber: data.sequence_number,
      eventHash: data.event_hash,
      summary: data.summary,
      aiInsight: data.ai_insight || undefined,
      eventData: toRecord(data.event_data),
      recordedBy: data.recorded_by || undefined,
      occurredAt: toRequiredDate(data.occurred_at),
    };
  }

  async getLastSequenceAndHash(tenantId: string, aggregateType: string, aggregateId: string): Promise<{ sequenceNumber: number; eventHash: string } | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('timeline_events')
      .select('sequence_number, event_hash')
      .eq('tenant_id', tenantId)
      .eq('aggregate_type', aggregateType)
      .eq('aggregate_id', aggregateId)
      .order('sequence_number', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return null;

    return {
      sequenceNumber: data[0].sequence_number,
      eventHash: data[0].event_hash,
    };
  }

  async query(tenantId: string, filter: TimelineFilter): Promise<TimelineEvent[]> {
    const supabase = await createClient();

    let query = supabase
      .from('timeline_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('occurred_at', { ascending: true });

    if (filter.primaryPartyId) query = query.eq('primary_party_id', filter.primaryPartyId);
    if (filter.journeyId) query = query.eq('journey_id', filter.journeyId);
    if (filter.correlationId) query = query.eq('correlation_id', filter.correlationId);
    if (filter.aggregateType) query = query.eq('aggregate_type', filter.aggregateType);
    if (filter.aggregateId) query = query.eq('aggregate_id', filter.aggregateId);
    if (filter.eventCategory) query = query.eq('event_category', filter.eventCategory);
    if (filter.eventType) query = query.eq('event_type', filter.eventType);
    if (filter.from) query = query.gte('occurred_at', filter.from.toISOString());
    if (filter.to) query = query.lte('occurred_at', filter.to.toISOString());

    const { data, error } = await query
      .limit(filter.limit || 100)
      .range(filter.offset || 0, (filter.offset || 0) + (filter.limit || 100) - 1);

    if (error || !data) return [];

    return data.map((d: TimelineEventRow) => ({
      id: d.id,
      tenantId: d.tenant_id,
      vertical: d.vertical,
      primaryPartyId: d.primary_party_id,
      journeyId: d.journey_id || undefined,
      correlationId: d.correlation_id,
      causationId: d.causation_id || undefined,
      eventCategory: toTimelineCategory(d.event_category),
      eventType: d.event_type,
      eventVersion: d.event_version,
      schemaVersion: d.schema_version,
      aggregateId: d.aggregate_id,
      aggregateType: d.aggregate_type,
      sequenceNumber: d.sequence_number,
      eventHash: d.event_hash,
      summary: d.summary,
      aiInsight: d.ai_insight || undefined,
      eventData: toRecord(d.event_data),
      recordedBy: d.recorded_by || undefined,
      occurredAt: toRequiredDate(d.occurred_at),
    }));
  }

  async getForReplay(tenantId: string, aggregateType: string, aggregateId: string): Promise<TimelineEvent[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('timeline_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('aggregate_type', aggregateType)
      .eq('aggregate_id', aggregateId)
      .order('sequence_number', { ascending: true });

    if (error || !data) return [];

    return data.map((d: TimelineEventRow) => ({
      id: d.id,
      tenantId: d.tenant_id,
      vertical: d.vertical,
      primaryPartyId: d.primary_party_id,
      journeyId: d.journey_id || undefined,
      correlationId: d.correlation_id,
      causationId: d.causation_id || undefined,
      eventCategory: toTimelineCategory(d.event_category),
      eventType: d.event_type,
      eventVersion: d.event_version,
      schemaVersion: d.schema_version,
      aggregateId: d.aggregate_id,
      aggregateType: d.aggregate_type,
      sequenceNumber: d.sequence_number,
      eventHash: d.event_hash,
      summary: d.summary,
      aiInsight: d.ai_insight || undefined,
      eventData: toRecord(d.event_data),
      recordedBy: d.recorded_by || undefined,
      occurredAt: toRequiredDate(d.occurred_at),
    }));
  }

  async updateAiInsight(tenantId: string, eventId: string, insight: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('timeline_events')
      .update({
        ai_insight: insight,
      })
      .eq('tenant_id', tenantId)
      .eq('id', eventId);

    if (error) throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. SUPABASE ASSET REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════

export class SupabaseAssetRepository implements IAssetRepository {
  async create(tenantId: string, input: CreateAssetInput, actorId: string): Promise<Asset> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('asset_assets')
      .insert({
        tenant_id: tenantId,
        vertical: input.vertical,
        asset_type: input.assetType,
        name: input.name,
        description: input.description,
        owner_party_id: input.ownerPartyId || null,
        status: input.status || 'active',
        metadata: toJson(input.metadata ?? {}),
        created_by: actorId,
        updated_by: actorId,
      })
      .select()
      .single();

    if (error || !data) throw error || new Error('Failed to create asset');

    return this.mapAsset(data);
  }

  async findById(tenantId: string, id: string): Promise<Asset | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('asset_assets')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapAsset(data);
  }

  async findByOwner(tenantId: string, ownerPartyId: string, filter?: Partial<AssetFilter>): Promise<Asset[]> {
    const supabase = await createClient();

    let query = supabase
      .from('asset_assets')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('owner_party_id', ownerPartyId)
      .is('deleted_at', null);

    if (filter?.assetType) query = query.eq('asset_type', filter.assetType);

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(this.mapAsset);
  }

  async findMany(tenantId: string, filter?: AssetFilter): Promise<Asset[]> {
    const supabase = await createClient();

    let query = supabase
      .from('asset_assets')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (filter) {
      if (filter.vertical) query = query.eq('vertical', filter.vertical);
      if (filter.assetType) query = query.eq('asset_type', filter.assetType);
      if (filter.ownerPartyId) query = query.eq('owner_party_id', filter.ownerPartyId);
      if (filter.status) query = query.eq('status', filter.status);
    }

    const { data, error } = await query
      .limit(filter?.limit || 50)
      .range(filter?.offset || 0, (filter?.offset || 0) + (filter?.limit || 50) - 1);

    if (error || !data) return [];
    return data.map(this.mapAsset);
  }

  async updateStatus(tenantId: string, input: UpdateAssetStatusInput, actorId: string): Promise<Asset> {
    const supabase = await createClient();

    // 1. Fetch existing asset events to append new event
    const existing = await this.findById(tenantId, input.assetId);
    if (!existing) throw new Error('Asset not found');

    const newEvents = [
      ...existing.events,
      {
        ...input.event,
        occurredAt: new Date(),
      },
    ];

    const { data, error } = await supabase
      .from('asset_assets')
      .update({
        status: input.status,
        events: toJson(newEvents),
        version: input.expectedVersion + 1,
        updated_by: actorId,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', input.assetId)
      .eq('version', input.expectedVersion)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Optimistic locking: version mismatch or asset not found');

    return this.mapAsset(data);
  }

  async transferOwnership(tenantId: string, assetId: string, newOwnerPartyId: string, expectedVersion: number, actorId: string): Promise<Asset> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('asset_assets')
      .update({
        owner_party_id: newOwnerPartyId,
        version: expectedVersion + 1,
        updated_by: actorId,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', assetId)
      .eq('version', expectedVersion)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Optimistic locking mismatch or asset not found');

    return this.mapAsset(data);
  }

  async softDelete(tenantId: string, assetId: string, actorId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('asset_assets')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: actorId,
      })
      .eq('tenant_id', tenantId)
      .eq('id', assetId);

    if (error) throw error;
  }

  private mapAsset(d: AssetRow): Asset {
    return {
      id: d.id,
      tenantId: d.tenant_id,
      vertical: d.vertical,
      assetType: d.asset_type as 'equipment' | 'inventory' | 'facility' | 'digital',
      name: d.name,
      description: d.description || undefined,
      ownerPartyId: d.owner_party_id || undefined,
      status: d.status as 'active' | 'inactive' | 'maintenance' | 'retired',
      metadata: toRecord(d.metadata),
      events: toArray(d.events).flatMap((event) => {
        const e = toRecord(toJson(event));
        if (typeof e.eventType !== 'string' || typeof e.description !== 'string') return [];
        return [{
          eventType: e.eventType,
          description: e.description,
          recordedBy: typeof e.recordedBy === 'string' ? e.recordedBy : undefined,
          occurredAt: typeof e.occurredAt === 'string' ? toRequiredDate(e.occurredAt) : new Date(),
          metadata: toRecord(toJson(e.metadata)),
        }];
      }),
      version: d.version,
      createdAt: toRequiredDate(d.created_at),
      updatedAt: toRequiredDate(d.updated_at),
      deletedAt: toDate(d.deleted_at),
      createdBy: d.created_by || undefined,
      updatedBy: d.updated_by || undefined,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. SUPABASE CONTRACT REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════

export class SupabaseContractRepository implements IContractRepository {
  async create(tenantId: string, input: CreateContractInput, actorId: string): Promise<Contract> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('contract_contracts')
      .insert({
        tenant_id: tenantId,
        vertical: input.vertical,
        contract_type: input.contractType,
        contract_number: input.contractNumber || null,
        parties: toJson(input.parties),
        journey_id: input.journeyId || null,
        status: 'draft',
        start_date: input.startDate ? input.startDate.toISOString().split('T')[0] : null,
        end_date: input.endDate ? input.endDate.toISOString().split('T')[0] : null,
        total_value: input.totalValue || null,
        currency: input.currency || 'VND',
        payment_schedule: toJson(input.paymentSchedule ?? null),
        line_items: toJson(input.lineItems ?? []),
        terms: toJson(input.terms ?? {}),
        created_by: actorId,
        updated_by: actorId,
      })
      .select()
      .single();

    if (error || !data) throw error || new Error('Failed to create contract');

    return this.mapContract(data);
  }

  async findById(tenantId: string, id: string): Promise<Contract | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('contract_contracts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapContract(data);
  }

  async findMany(tenantId: string, filter?: ContractFilter): Promise<Contract[]> {
    const supabase = await createClient();

    let query = supabase
      .from('contract_contracts')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (filter) {
      if (filter.vertical) query = query.eq('vertical', filter.vertical);
      if (filter.contractType) query = query.eq('contract_type', filter.contractType);
      if (filter.journeyId) query = query.eq('journey_id', filter.journeyId);
      if (filter.status) query = query.eq('status', filter.status);
    }

    const { data, error } = await query
      .limit(filter?.limit || 50)
      .range(filter?.offset || 0, (filter?.offset || 0) + (filter?.limit || 50) - 1);

    if (error || !data) return [];
    return data.map(this.mapContract);
  }

  async activate(tenantId: string, contractId: string, expectedVersion: number, actorId: string): Promise<Contract> {
    return this.updateStatus(tenantId, contractId, 'active', expectedVersion, actorId);
  }

  async suspend(tenantId: string, contractId: string, reason: string, expectedVersion: number, actorId: string): Promise<Contract> {
    return this.updateStatus(tenantId, contractId, 'suspended', expectedVersion, actorId);
  }

  async complete(tenantId: string, contractId: string, expectedVersion: number, actorId: string): Promise<Contract> {
    return this.updateStatus(tenantId, contractId, 'completed', expectedVersion, actorId);
  }

  async cancel(tenantId: string, contractId: string, reason: string, expectedVersion: number, actorId: string): Promise<Contract> {
    return this.updateStatus(tenantId, contractId, 'cancelled', expectedVersion, actorId);
  }

  async markSigned(tenantId: string, contractId: string, signedBy: string, expectedVersion: number): Promise<Contract> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('contract_contracts')
      .update({
        signed_at: new Date().toISOString(),
        signed_by: signedBy,
        status: 'active', // Autoclose to active on signature
        version: expectedVersion + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', contractId)
      .eq('version', expectedVersion)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Optimistic lock check failed or contract not found');

    return this.mapContract(data);
  }

  async softDelete(tenantId: string, contractId: string, actorId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('contract_contracts')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: actorId,
      })
      .eq('tenant_id', tenantId)
      .eq('id', contractId);

    if (error) throw error;
  }

  private async updateStatus(
    tenantId: string,
    contractId: string,
    status: ContractStatus,
    expectedVersion: number,
    actorId: string
  ): Promise<Contract> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('contract_contracts')
      .update({
        status,
        version: expectedVersion + 1,
        updated_by: actorId,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', contractId)
      .eq('version', expectedVersion)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Optimistic lock check failed');

    return this.mapContract(data);
  }

  private mapContract(d: ContractRow): Contract {
    return {
      id: d.id,
      tenantId: d.tenant_id,
      vertical: d.vertical,
      contractType: d.contract_type as 'service' | 'product' | 'subscription' | 'employment',
      contractNumber: d.contract_number || undefined,
      parties: toContractParties(d.parties),
      journeyId: d.journey_id || undefined,
      status: d.status as ContractStatus,
      startDate: toDate(d.start_date),
      endDate: toDate(d.end_date),
      totalValue: d.total_value ? Number(d.total_value) : undefined,
      currency: d.currency,
      paymentSchedule: toPaymentSchedule(d.payment_schedule),
      lineItems: toContractLineItems(d.line_items),
      terms: toRecord(d.terms),
      signedAt: toDate(d.signed_at),
      signedBy: d.signed_by || undefined,
      version: d.version,
      createdAt: toRequiredDate(d.created_at),
      updatedAt: toRequiredDate(d.updated_at),
      deletedAt: toDate(d.deleted_at),
      createdBy: d.created_by || undefined,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. SUPABASE KNOWLEDGE REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════

export class SupabaseKnowledgeRepository implements IKnowledgeRepository {
  async createEntry(entry: Omit<KnowledgeEntry, 'id' | 'createdAt'>): Promise<KnowledgeEntry> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('knowledge_entries')
      .insert({
        tenant_id: entry.tenantId,
        vertical: entry.vertical,
        domain: entry.domain,
        code: entry.code,
        label: entry.label,
        description: entry.description,
        version: entry.version,
        effective_from: entry.effectiveFrom.toISOString(),
        effective_to: entry.effectiveTo ? entry.effectiveTo.toISOString() : null,
        source: entry.source,
        approved_by: entry.approvedBy || null,
        metadata: toJson(entry.metadata ?? {}),
      })
      .select()
      .single();

    if (error || !data) throw error || new Error('Failed to create knowledge entry');

    return this.mapEntry(data);
  }

  async findEntryByCode(tenantId: string, vertical: string, domain: KnowledgeDomain, code: string, atDate?: Date): Promise<KnowledgeEntry | null> {
    const supabase = await createClient();
    const queryDate = atDate || new Date();

    const query = supabase
      .from('knowledge_entries')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('vertical', vertical)
      .eq('domain', domain)
      .eq('code', code)
      .lte('effective_from', queryDate.toISOString());

    // Filter dynamic effective end
    const { data, error } = await query;
    if (error || !data || data.length === 0) return null;

    // Filter valid items in memory (where effective_to is null or greater than target date)
    const valid = data.find((d: KnowledgeEntryRow) => !d.effective_to || new Date(d.effective_to) > queryDate);
    if (!valid) return null;

    return this.mapEntry(valid);
  }

  async addGraphEdge(tenantId: string, edge: KnowledgeGraphEdge): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('knowledge_graph_edges')
      .insert({
        tenant_id: tenantId,
        source_code: edge.sourceCode,
        source_type: edge.sourceType,
        target_code: edge.targetCode,
        target_type: edge.targetType,
        relationship_type: edge.relationshipType,
        strength: edge.strength || 1.00,
        evidence_source: edge.evidenceSource,
      });

    if (error) throw error;
  }

  async getGraphNeighbors(tenantId: string, code: string, type: KnowledgeDomain): Promise<KnowledgeGraphEdge[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('knowledge_graph_edges')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('source_code', code)
      .eq('source_type', type);

    if (error || !data) return [];

    return data.map((d: KnowledgeGraphEdgeRow) => ({
      sourceCode: d.source_code,
      sourceType: d.source_type as KnowledgeDomain,
      targetCode: d.target_code,
      targetType: d.target_type as KnowledgeDomain,
      relationshipType: d.relationship_type,
      strength: d.strength ?? undefined,
      evidenceSource: d.evidence_source || undefined,
    }));
  }

  async semanticSearch(tenantId: string, vertical: string, query: string, limit = 10): Promise<KnowledgeSearchResult[]> {
    const supabase = await createClient();

    // Fallback: pgvector requires generating query embeddings and query using raw SQL.
    // In our bootstrap environment, we can fallback to standard text ILIKE lookup if vector is null
    // or perform a simple search query on postgres.
    const { data, error } = await supabase
      .from('knowledge_entries')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('vertical', vertical)
      .or(`label.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(limit);

    if (error || !data) return [];

    return data.map((d: KnowledgeEntryRow) => ({
      entry: this.mapEntry(d),
      score: 0.95, // mock score for text search fallback
    }));
  }

  async createInferenceRule(rule: Omit<InferenceRule, 'id' | 'createdAt'>): Promise<InferenceRule> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('knowledge_inference_rules')
      .insert({
        tenant_id: rule.tenantId,
        vertical: rule.vertical,
        code: rule.code,
        name: rule.name,
        trigger_type: rule.triggerType,
        conditions: toJson(rule.conditions),
        action: toJson(rule.action),
        version: rule.version,
        effective_from: rule.effectiveFrom.toISOString(),
        effective_to: rule.effectiveTo ? rule.effectiveTo.toISOString() : null,
      })
      .select()
      .single();

    if (error || !data) throw error || new Error('Failed to create inference rule');

    return this.mapInferenceRule(data);
  }

  async evaluateInference(tenantId: string, vertical: string, facts: Record<string, unknown>): Promise<InferenceCheckResult> {
    const supabase = await createClient();

    // Load active inference rules
    const { data: rules, error } = await supabase
      .from('knowledge_inference_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('vertical', vertical);

    if (error || !rules) {
      return { triggered: false, rules: [], warnings: [], blockers: [] };
    }

    const triggeredRules: Array<{ rule: InferenceRule; action: InferenceRule['action'] }> = [];
    const warnings: string[] = [];
    const blockers: string[] = [];

    for (const r of rules) {
      const parsedRule = this.mapInferenceRule(r);
      let conditionsSatisfied = true;

      // Evaluate conditions AST
      for (const cond of parsedRule.conditions) {
        const factValue = facts[cond.field];
        let condMet = false;

        switch (cond.operator) {
          case 'eq':
            condMet = factValue === cond.value;
            break;
          case 'neq':
            condMet = factValue !== cond.value;
            break;
          case 'gt':
            condMet = Number(factValue) > Number(cond.value);
            break;
          case 'lt':
            condMet = Number(factValue) < Number(cond.value);
            break;
          case 'contains':
            if (Array.isArray(factValue)) {
              condMet = factValue.includes(cond.value);
            } else if (typeof factValue === 'string') {
              condMet = factValue.includes(String(cond.value));
            }
            break;
          case 'in':
            if (Array.isArray(cond.value)) {
              condMet = cond.value.includes(factValue);
            }
            break;
          case 'not_in':
            if (Array.isArray(cond.value)) {
              condMet = !cond.value.includes(factValue);
            }
            break;
        }

        if (!condMet) {
          conditionsSatisfied = false;
          break;
        }
      }

      if (conditionsSatisfied) {
        triggeredRules.push({ rule: parsedRule, action: parsedRule.action });
        const msg = String(parsedRule.action.payload.message || `Rule ${parsedRule.code} triggered`);
        if (parsedRule.action.type === 'block') {
          blockers.push(msg);
        } else {
          warnings.push(msg);
        }
      }
    }

    return {
      triggered: triggeredRules.length > 0,
      rules: triggeredRules,
      warnings,
      blockers,
    };
  }

  async findPromptTemplate(tenantId: string, vertical: string, code: string): Promise<PromptTemplate | null> {
    // In our base MVP runtime, we can mock prompt template lookup or select from metadata table.
    return {
      id: crypto.randomUUID(),
      tenantId,
      vertical,
      code,
      name: 'System standard prompt',
      systemPrompt: 'You are an AI Clinical Assistant. Work according to policies.',
      userPromptTemplate: 'Analyze: {{input}}',
      requiredContext: ['input'],
      version: '1.0.0',
      createdAt: new Date(),
    };
  }

  async findOntologyTerm(_vertical: string, _termCode: string): Promise<OntologyTerm | null> {
    return null;
  }

  async getOntologyChildren(_vertical: string, _parentTermCode: string): Promise<OntologyTerm[]> {
    return [];
  }

  private mapEntry(d: KnowledgeEntryRow): KnowledgeEntry {
    return {
      id: d.id,
      tenantId: d.tenant_id,
      vertical: d.vertical,
      domain: d.domain as KnowledgeDomain,
      code: d.code,
      label: d.label,
      description: d.description || undefined,
      version: d.version,
      effectiveFrom: toRequiredDate(d.effective_from),
      effectiveTo: toDate(d.effective_to),
      source: d.source || undefined,
      approvedBy: d.approved_by || undefined,
      metadata: toRecord(d.metadata),
      createdAt: toRequiredDate(d.created_at),
    };
  }

  private mapInferenceRule(d: InferenceRuleRow): InferenceRule {
    return {
      id: d.id,
      tenantId: d.tenant_id,
      vertical: d.vertical,
      code: d.code,
      name: d.name,
      triggerType: d.trigger_type as 'pre_action' | 'post_action' | 'periodic',
      conditions: toInferenceConditions(d.conditions),
      action: toInferenceAction(d.action),
      version: d.version,
      effectiveFrom: toRequiredDate(d.effective_from),
      effectiveTo: toDate(d.effective_to),
      createdAt: toRequiredDate(d.created_at),
    };
  }
}
