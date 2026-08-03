/**
 * GET /api/bella-auto/rules - List all rules
 * POST /api/bella-auto/rules - Create new rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrimaryClient } from '@/lib/database/read-replica';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const supabase = getPrimaryClient();
    const { searchParams } = new URL(request.url);
    
    const entityType = searchParams.get('entity_type');
    const isActive = searchParams.get('is_active');
    
    let query = supabase
      .from('auto_business_rules')
      .select('*')
      .order('priority', { ascending: true });

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch rules', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ rules: data });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getPrimaryClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('auto_business_rules')
      .insert({
        tenant_id: body.tenantId,
        code: body.code,
        name: body.name,
        description: body.description,
        entity_type: body.entityType,
        priority: body.priority || 100,
        conditions: body.conditions,
        actions: body.actions,
        is_active: body.isActive !== false,
        effective_from: body.effectiveFrom,
        effective_until: body.effectiveUntil,
        created_by: body.userId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create rule', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ rule: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
