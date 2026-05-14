
const { createClient } = require('@supabase/supabase-js');

async function checkAuditLogs() {
  const supabase = createClient(
    'https://lvnvkpyxtuilhrabtlwv.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2bnZrcHl4dHVpbGhyYWJ0bHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NzIxMjksImV4cCI6MjA5NDA0ODEyOX0.eOdkh5g-Te7ALOWHgVl7HSqzkK933rQQY2Cp8w7m2U0'
  );

  console.log('--- AUDIT LOGS TABLE ---');
  const { data: auditLogs, error: aError } = await supabase.from('audit_logs').select('*').limit(1);
  if (aError) {
    console.log('Audit logs error (maybe table missing):', aError.message);
  } else {
    console.log('Audit logs found (sample):', auditLogs);
  }
}

checkAuditLogs();
