'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';

export async function getChatCustomers() {
  const supabase = (await createClient()) as any;
  const user = await getCurrentUser();
  
  if (!user?.tenant_id) {
    throw new Error('Unauthorized: No tenant_id found');
  }

  const { data, error } = await supabase.rpc('get_chat_customers', {
    p_tenant_id: user.tenant_id
  });

  if (error) {
    console.error('Error fetching chat customers:', error);
    return [];
  }

  return data;
}

export async function getChatMessages(customerId: string) {
  const supabase = (await createClient()) as any;
  const user = await getCurrentUser();
  
  if (!user?.tenant_id) {
    throw new Error('Unauthorized: No tenant_id found');
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('customer_id', customerId)
    .eq('tenant_id', user.tenant_id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching chat messages:', error);
    return [];
  }

  return data;
}

export async function sendChatMessage(customerId: string, message: string, senderType: 'customer' | 'staff'): Promise<any> {
  const supabase = (await createClient()) as any;
  const user = await getCurrentUser();
  
  if (!user?.tenant_id) {
    throw new Error('Unauthorized: No tenant_id found');
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      customer_id: customerId,
      message,
      sender_type: senderType,
      sender_id: senderType === 'staff' ? user.id : null,
      tenant_id: user.tenant_id,
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
  const user = await getCurrentUser();
  
  if (!user?.tenant_id) return;

  const { error } = await supabase
    .from('chat_messages')
    .update({ is_read: true })
    .eq('customer_id', customerId)
    .eq('tenant_id', user.tenant_id)
    .eq('sender_type', 'customer')
    .eq('is_read', false);

  if (error) {
    console.error('Error marking messages as read:', error);
  }
}
