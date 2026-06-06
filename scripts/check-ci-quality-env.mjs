const REQUIRED_GROUPS = [
  {
    label: 'Supabase database URL for migration drift checks',
    names: ['SUPABASE_DB_URL', 'SUPABASE_DATABASE_URL'],
  },
  {
    label: 'Supabase public URL for local smoke rendering',
    names: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'],
  },
  {
    label: 'Supabase public browser key for local smoke rendering',
    names: ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  },
  {
    label: 'Supabase elevated server key for smoke checks',
    names: ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
  },
];

function hasValue(name) {
  return Boolean(process.env[name]?.trim());
}

const missing = REQUIRED_GROUPS.filter((group) => !group.names.some(hasValue));

if (missing.length > 0) {
  console.error('CI quality gate is missing required environment config:');
  for (const group of missing) {
    console.error(`- ${group.label}: set one of ${group.names.join(' or ')}`);
  }
  process.exit(1);
}

console.log(`CI quality gate environment config is ready (${REQUIRED_GROUPS.length} groups checked).`);
