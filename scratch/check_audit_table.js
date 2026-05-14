
const { createClient } = require('@supabase/supabase-js');

async function checkAuditLogs() {
  const supabase = createClient(
    'https://lvnvkpyxtuilhrabtlwv.supabase.co',
    'PLACEHOLDER_SUPABASE_ANON_KEY'
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
