'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';

export async function getChatCustomers() {
  const supabase = (await createClient()) as any;
  
  // Directly call the parameterless RPC which uses auth.uid() internally on Postgres
  const { data, error } = await supabase.rpc('get_chat_customers');

  if (error) {
    console.error('Error fetching chat customers:', error);
    return [];
  }

  return data;
}

export async function getChatMessages(customerId: string) {
  const supabase = (await createClient()) as any;
  
  // RLS handles tenant isolation
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching chat messages:', error);
    return [];
  }

  return data;
}

export async function sendChatMessage(customerId: string, message: string, senderType: 'customer' | 'staff'): Promise<any> {
  const supabase = (await createClient()) as any;
  
  const { data: customerData } = await supabase.from('customers').select('tenant_id').eq('id', customerId).single();
  const tenantId = customerData?.tenant_id;
  if (!tenantId) {
    throw new Error('Không tìm thấy chi nhánh hợp lệ cho khách hàng này.');
  }
  
  // Determine auth user safely without crashing
  const { data: { user: authUser } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      customer_id: customerId,
      message,
      sender_type: senderType,
      sender_id: senderType === 'staff' ? (authUser?.id || null) : null,
      tenant_id: tenantId,
      is_read: false
    })
    .select()
    .single();

  if (error) {
    console.error('Error sending chat message:', error);
    throw error;
  }

  return data;
}

export async function markMessagesAsRead(customerId: string) {
  const supabase = (await createClient()) as any;
  
  const { data: customerData } = await supabase.from('customers').select('tenant_id').eq('id', customerId).single();
  const tenantId = customerData?.tenant_id;
  if (!tenantId) return;

  const { error } = await supabase
    .from('chat_messages')
    .update({ is_read: true } as any)
    .eq('customer_id', customerId)
    .eq('sender_type', 'customer')
    .eq('is_read', false)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('Error marking messages as read:', error);
  }
}
