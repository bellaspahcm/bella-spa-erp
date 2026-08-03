/**
 * GET /api/bella-auto/rules/[id] - Get rule detail
 * PUT /api/bella-auto/rules/[id] - Update rule
 * DELETE /api/bella-auto/rules/[id] - Delete rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrimaryClient } from '../../../../../../lib/database/read-replica';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getPrimaryClient();
    const { id } = params;

    const { data, error } = await supabase
      .from('auto_business_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ rule: data });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getPrimaryClient();
    const { id } = params;
    const body = await request.json();

    const { data, error } = await supabase
      .from('auto_business_rules')
      .update({
        name: body.name,
        description: body.description,
        priority: body.priority,
        conditions: body.conditions,
        actions: body.actions,
        is_active: body.isActive,
        effective_from: body.effectiveFrom,
        effective_until: body.effectiveUntil,
        updated_by: body.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update rule' },
        { status: 500 }
      );
    }

    return NextResponse.json({ rule: data });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getPrimaryClient();
    const { id } = params;

    const { error } = await supabase
      .from('auto_business_rules')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete rule' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
