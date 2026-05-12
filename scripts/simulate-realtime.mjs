import fs from 'fs';

// Load env
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(line => line.includes('='))
    .map(line => {
      const [key, ...value] = line.split('=');
      return [key.trim(), value.join('=').trim()];
    })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function get(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { headers });
  return await res.json();
}

async function patch(table, id, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(data)
  });
  return res.ok;
}

async function post(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });
  return res.ok;
}

async function simulate() {
  console.log('--- REALTIME DEMO SIMULATION STARTED ---');
  console.log('Updating database every 15 seconds to show live changes...');
  
  const bookings = await get('bookings?status=eq.in_progress&limit=10');
  const ktvs = await get('users?role=eq.ktv&limit=5');
  
  let step = 0;
  
  const interval = setInterval(async () => {
    step++;
    const booking = bookings[step % bookings.length];
    const ktv = ktvs[step % ktvs.length];
    
    try {
      if (step % 2 === 0) {
        // Sim: Complete a session
        console.log(`[SIM] Completing session for booking ${booking.booking_number}...`);
        
        // 1. Update Booking Progress
        const newCompletedCount = (booking.completed_sessions || 0) + 1;
        await patch('bookings', booking.id, { completed_sessions: newCompletedCount });
        
        // 2. Update the next scheduled session log
        const logs = await get(`session_logs?booking_id=eq.${booking.id}&status=eq.scheduled&limit=1&order=session_number.asc`);
        if (logs && logs.length > 0) {
          const nextSession = logs[0];
          await patch('session_logs', nextSession.id, { 
            status: 'completed', 
            completed_date: new Date().toISOString(),
            notes: 'Mẹ và bé khỏe mạnh. Chăm sóc sau sinh tiêu chuẩn.'
          });
          console.log(`[SIM] Updated session log #${nextSession.session_number} to completed.`);
        }

        // 3. Add a revenue record for the session
        await post('revenue', {
          booking_id: booking.id,
          amount: 500000,
          revenue_type: 'session_completed',
          payment_method: 'cash',
          received_date: new Date().toISOString().split('T')[0],
          status: 'confirmed',
          tenant_id: booking.tenant_id
        });
      } else {
        // Sim: Add a new inquiry or update a status
        console.log(`[SIM] New activity recorded for customer...`);
        // Add a dummy expense or update something else
        await post('expenses', {
          category: 'Supplies',
          amount: 100000 + (Math.random() * 50000),
          description: 'Mua thêm khăn và vật tư tiêu hao',
          expense_date: new Date().toISOString().split('T')[0],
          status: 'approved',
          tenant_id: booking.tenant_id
        });
      }
    } catch (e) {
      console.error('Sim error:', e.message);
    }
    
    if (step > 20) {
      console.log('Simulation cycle complete.');
      clearInterval(interval);
    }
  }, 15000);
}

simulate();
