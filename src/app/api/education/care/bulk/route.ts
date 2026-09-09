import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DailyCareService } from '@/products/bella-education/care-wellbeing/daily-care/daily-care.service';

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseKey) {
      return NextResponse.json({ error: 'Supabase key not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const dailyCareService = new DailyCareService(supabase);

    const body = await request.json();
    const { action, tenantId, classId, date, data } = body;

    if (!tenantId || !classId || !date || !action) {
      return NextResponse.json({ error: 'Missing required parameters: tenantId, classId, date, action' }, { status: 400 });
    }

    let result;

    switch (action) {
      case 'arrival':
        result = await dailyCareService.recordBulkArrival({
          tenantId,
          classId,
          date,
          arrivals: data.arrivals || [],
        });
        break;

      case 'meal':
        result = await dailyCareService.recordBulkMeals({
          tenantId,
          classId,
          date,
          mealItemId: data.mealItemId,
          mealType: data.mealType || 'LUNCH',
          students: data.students || [],
        });
        break;

      case 'hygiene':
        result = await dailyCareService.recordBulkHygiene({
          tenantId,
          classId,
          date,
          hygieneEntries: data.hygieneEntries || [],
        });
        break;

      case 'nap':
        result = await dailyCareService.recordBulkNap({
          tenantId,
          classId,
          date,
          napEntries: data.napEntries || [],
        });
        break;

      default:
        return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Care Bulk API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
