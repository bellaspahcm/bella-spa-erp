import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MedicationSafetyService } from '@/products/bella-education/care-wellbeing/medication/medication-safety.service';

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseKey) {
      return NextResponse.json({ error: 'Supabase key not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const medService = new MedicationSafetyService(supabase);

    const body = await request.json();
    const { tenantId, studentId, doseOccurrenceId, doseGiven, actorId, notes } = body;

    if (!tenantId || !studentId || !doseOccurrenceId || !actorId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const result = await medService.administerDose({
      tenantId,
      studentId,
      doseOccurrenceId,
      administeredAt: new Date(),
      doseGiven: doseGiven || 'Standard Dose',
      actorId,
      notes,
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Medication Admin API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
