import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { Database } from '@/types/database.types';

type LeadRow = Database['public']['Tables']['re_partner_leads']['Row'];
type LeadInsert = Database['public']['Tables']['re_partner_leads']['Insert'];

/**
 * GET /api/partner/leads
 * Fetch all leads for the authenticated user with protection status
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      );
    }

    // Get user's tenant_id from profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      return NextResponse.json(
        { error: 'User profile not found or missing tenant' },
        { status: 400 }
      );
    }

    // Fetch leads for this user
    const { data: leads, error: leadsError } = await supabase
      .from('re_partner_leads')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (leadsError) {
      console.error('[API /partner/leads] Failed to fetch leads:', leadsError);
      return NextResponse.json(
        { error: 'Failed to fetch leads', details: leadsError.message },
        { status: 500 }
      );
    }

    // Calculate protection status for each lead
    const now = new Date();
    const enrichedLeads = (leads || []).map((lead: LeadRow) => ({
      ...lead,
      isProtected: new Date(lead.protected_until) > now,
      daysRemaining: Math.max(
        0, 
        Math.ceil((new Date(lead.protected_until).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      ),
    }));

    return NextResponse.json({
      success: true,
      data: enrichedLeads,
      count: enrichedLeads.length,
    });

  } catch (error) {
    console.error('[API /partner/leads] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/partner/leads
 * Create a new lead with duplicate phone check
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      );
    }

    // Get user's tenant_id
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      return NextResponse.json(
        { error: 'User profile not found or missing tenant' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { name, phone, email, budget, notes } = body;

    // Validation
    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json(
        { error: 'Name and phone are required' },
        { status: 400 }
      );
    }

    // Check for duplicate phone within the same tenant
    // This protects broker commission entitlement
    const { data: existingLead, error: checkError } = await supabase
      .from('re_partner_leads')
      .select('id, user_id, name, created_at')
      .eq('tenant_id', profile.tenant_id)
      .eq('phone', phone.trim())
      .maybeSingle();

    if (checkError) {
      console.error('[API /partner/leads] Duplicate check failed:', checkError);
      return NextResponse.json(
        { error: 'Failed to check duplicate phone', details: checkError.message },
        { status: 500 }
      );
    }

    if (existingLead) {
      const isOwnLead = existingLead.user_id === user.id;
      return NextResponse.json(
        { 
          error: isOwnLead 
            ? 'Bạn đã đăng ký số điện thoại này trước đó' 
            : 'Số điện thoại này đã được đăng ký bởi đối tác khác',
          duplicate: true,
          existingLeadId: existingLead.id,
          existingLeadName: existingLead.name,
          createdAt: existingLead.created_at,
        },
        { status: 409 }
      );
    }

    // Calculate protection expiry (30 days from now)
    const protectedUntil = new Date();
    protectedUntil.setDate(protectedUntil.getDate() + 30);

    // Create new lead
    const newLead: LeadInsert = {
      tenant_id: profile.tenant_id,
      user_id: user.id,
      created_by: user.id,
      name: name.trim(),
      phone: phone.trim(),
      email: email?.trim() || null,
      budget: budget || null,
      notes: notes?.trim() || null,
      status: 'registered',
      protected_until: protectedUntil.toISOString(),
      metadata: {
        source: 'partner_portal',
        created_via: 'web',
      },
    };

    const { data: createdLead, error: insertError } = await supabase
      .from('re_partner_leads')
      .insert(newLead)
      .select()
      .single();

    if (insertError) {
      console.error('[API /partner/leads] Failed to create lead:', insertError);
      return NextResponse.json(
        { error: 'Failed to create lead', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Đăng ký khách hàng thành công! Quyền bảo vệ có hiệu lực trong 30 ngày.',
      data: createdLead,
    }, { status: 201 });

  } catch (error) {
    console.error('[API /partner/leads] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
