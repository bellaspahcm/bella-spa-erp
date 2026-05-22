const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const sessionId = '5bdd7f82-730b-4fef-b84d-7b7013d2055f';
  await supabase.from('session_logs').update({ status: 'scheduled', completed_by_ktv_id: null, start_time: null }).eq('id', sessionId);

  const { data: sessionLog, error: sessionError } = await supabase
    .from('session_logs')
    .select('*, bookings ( id, status, completed_sessions, total_sessions )')
    .eq('id', sessionId)
    .single();

  console.log("sessionLog:", sessionLog);
  console.log("sessionError:", sessionError);

  if (sessionLog.bookings?.status === 'completed') {
    console.log('Gói liệu trình này đã hoàn thành. Không thể bắt đầu thêm buổi.');
    return;
  }

  if (sessionLog.bookings && sessionLog.session_number > sessionLog.bookings.total_sessions) {
    console.log('Buổi này vượt quá tổng số buổi của liệu trình.');
    return;
  }

  const assignedDateStr = sessionLog.assigned_date;
  if (assignedDateStr) {
    const localDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    if (localDateStr !== assignedDateStr) {
       console.log(`Chỉ có thể check-in vào đúng ngày được phân công (${assignedDateStr}). Local is ${localDateStr}`);
       return;
    }
  }

  if (sessionLog.status !== 'scheduled') {
    console.log('Trạng thái ca không hợp lệ để check in.');
    return;
  }
  
  console.log("All checks passed!");
}
main();
