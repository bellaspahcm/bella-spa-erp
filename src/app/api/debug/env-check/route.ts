/**
 * Debug: Check Environment Variables
 * GET /api/debug/env-check
 * 
 * Returns first/last 10 chars of sensitive env vars for verification
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  return NextResponse.json({
    env: process.env.NODE_ENV,
    hasServiceRoleKey: !!serviceRoleKey,
    serviceRoleKeyPreview: serviceRoleKey 
      ? `${serviceRoleKey.substring(0, 10)}...${serviceRoleKey.substring(serviceRoleKey.length - 10)}`
      : 'NOT_SET',
    serviceRoleKeyLength: serviceRoleKey?.length || 0,
    startsWithJWT: serviceRoleKey?.startsWith('eyJ') || false,
    startsWithSecret: serviceRoleKey?.startsWith('sb_secret_') || false,
  });
}
