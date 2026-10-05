import { Client } from 'pg';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function runRealDbSql(label: string, sql: string) {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.SUPABASE_DATABASE_URL;
  if (!dbUrl) {
    throw new Error(`${label} failed: SUPABASE_DB_URL or SUPABASE_DATABASE_URL is required`);
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query(sql);
  } catch (error) {
    throw new Error(`${label} failed: ${getErrorMessage(error)}`);
  } finally {
    await client.end();
  }
}
